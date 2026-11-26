import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';

import {
  parse,
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  taskQuerySchema,
} from '../utils/validation.js';

import {
  TASK_SELECT,
  getTask,
  assertProjectMember,
} from '../services/tasks.js';

import { logActivity } from '../utils/activity.js';
import { emitToProject } from '../realtime/socket.js';
import commentsRouter from './comments.js';

// ==========================================
// ROUTER CONFIGURATION
// ==========================================

const router = Router({ mergeParams: true });

router.use('/:taskId/comments', commentsRouter);

// ==========================================
// TASK FIELD MAPPING
// ==========================================

const COLUMNS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  assigneeId: 'assignee_id',
  dueDate: 'due_date',
};

// Get the next available position in a column.

const nextPosition = async (db, projectId, status) =>
  (
    await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next
       FROM tasks
       WHERE project_id = $1 AND status = $2`,
      [projectId, status]
    )
  ).rows[0].next;

// ==========================================
// LIST TASKS + SEARCH + FILTER VALIDATION
// ==========================================

router.get('/', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Treat empty filter values as inactive filters.

  const rawQuery = Object.fromEntries(
    Object.entries(req.query).filter(
      ([, value]) => value !== ''
    )
  );

  // Validate query parameters before executing SQL.

  const {
    search,
    status,
    priority,
    assignee,
  } = parse(taskQuerySchema, rawQuery);

  const where = ['t.project_id = $1'];
  const params = [projectId];

  // Search by task title.

  if (search) {
    const escapedSearch = search.replace(
      /[\\%_]/g,
      '\\$&'
    );

    params.push(`%${escapedSearch}%`);

    where.push(
      `t.title ILIKE $${params.length}`
    );
  }

  // Filter by task status.

  if (status) {
    params.push(status);

    where.push(
      `t.status = $${params.length}`
    );
  }

  // Filter by task priority.

  if (priority) {
    params.push(priority);

    where.push(
      `t.priority = $${params.length}`
    );
  }

  // Filter unassigned tasks.

  if (assignee === 'none') {
    where.push('t.assignee_id IS NULL');
  }

  // Filter by assigned team member.

  else if (assignee) {
    params.push(assignee);

    where.push(
      `t.assignee_id = $${params.length}`
    );
  }

  // Execute parameterized SQL with deterministic ordering.

  const { rows } = await query(
    `${TASK_SELECT}
     WHERE ${where.join(' AND ')}
     ORDER BY t.position, t.created_at, t.id`,
    params
  );

  res.json({
    tasks: rows,
  });
}));

// ==========================================
// CREATE TASK
// ==========================================

router.post('/', asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const data = parse(
    createTaskSchema,
    req.body
  );

  // Ensure the selected assignee belongs to the project.

  if (data.assigneeId) {
    await assertProjectMember(
      { query },
      projectId,
      data.assigneeId
    );
  }

  const position = await nextPosition(
    { query },
    projectId,
    data.status
  );

  const {
    rows: [created],
  } = await query(
    `INSERT INTO tasks(
       project_id,
       title,
       description,
       status,
       priority,
       assignee_id,
       due_date,
       position,
       created_by
     )
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      projectId,
      data.title,
      data.description,
      data.status,
      data.priority,
      data.assigneeId ?? null,
      data.dueDate ?? null,
      position,
      req.user.id,
    ]
  );

  const task = await getTask(
    { query },
    projectId,
    created.id
  );

  // Broadcast newly created task.

  emitToProject(
    projectId,
    'tasks:upsert',
    {
      tasks: [task],
    }
  );

  // Record task creation activity.

  await logActivity(
    { query },
    {
      projectId,
      taskId: task.id,
      user: req.user,
      action: 'task.created',
      meta: {
        title: task.title,
      },
    }
  );

  // Record assignment activity when applicable.

  if (task.assignee_id) {
    await logActivity(
      { query },
      {
        projectId,
        taskId: task.id,
        user: req.user,
        action: 'task.assigned',
        meta: {
          title: task.title,
          from: null,
          to: task.assignee_name,
        },
      }
    );
  }

  res.status(201).json({
    task,
  });
}));

// ==========================================
// GET SINGLE TASK
// ==========================================

router.get('/:taskId', asyncHandler(async (req, res) => {
  const task = await getTask(
    { query },
    req.params.projectId,
    req.params.taskId
  );

  res.json({
    task,
  });
}));

// ==========================================
// UPDATE TASK
// WITH OPTIMISTIC CONCURRENCY PROTECTION
// ==========================================

router.patch('/:taskId', asyncHandler(async (req, res) => {
  const {
    projectId,
    taskId,
  } = req.params;

  const data = parse(
    updateTaskSchema,
    req.body
  );

  const {
    before,
    after,
    changed,
  } = await withTransaction(async (db) => {

    // Lock the task until this transaction finishes.

    const {
      rows: [lockedTask],
    } = await db.query(
      `SELECT id, version
       FROM tasks
       WHERE id = $1 AND project_id = $2
       FOR UPDATE`,
      [taskId, projectId]
    );

    if (!lockedTask) {
      throw new HttpError(
        404,
        'Task not found'
      );
    }

    // Reject outdated updates.

    if (
      data.expectedVersion !== undefined &&
      data.expectedVersion !== lockedTask.version
    ) {
      throw new HttpError(
        409,
        'This task has changed. Refresh and review the latest details before trying again.'
      );
    }

    const before = await getTask(
      db,
      projectId,
      taskId
    );

    // Validate assignee membership.

    if (data.assigneeId) {
      await assertProjectMember(
        db,
        projectId,
        data.assigneeId
      );
    }

    const sets = [];
    const values = [];
    const changed = [];

    // Update only fields that have actually changed.

    for (
      const [key, column] of Object.entries(COLUMNS)
    ) {
      if (!(key in data)) continue;

      if (
        String(before[column] ?? '') ===
        String(data[key] ?? '')
      ) {
        continue;
      }

      values.push(data[key]);

      sets.push(
        `${column} = $${values.length}`
      );

      changed.push(key);
    }

    // Avoid unnecessary updates.

    if (!changed.length) {
      return {
        before,
        after: before,
        changed,
      };
    }

    // Move to the bottom of the destination column
    // when the task status changes.

    if (changed.includes('status')) {
      values.push(
        await nextPosition(
          db,
          projectId,
          data.status
        )
      );

      sets.push(
        `position = $${values.length}`
      );
    }

    values.push(
      taskId,
      projectId
    );

    await db.query(
      `UPDATE tasks
       SET ${sets.join(', ')},
           updated_at = now()
       WHERE id = $${values.length - 1}
       AND project_id = $${values.length}`,
      values
    );

    // The database trigger automatically increments
    // the task version when tracked fields change.

    const after = await getTask(
      db,
      projectId,
      taskId
    );

    return {
      before,
      after,
      changed,
    };
  });

  // Return immediately when nothing changed.

  if (!changed.length) {
    return res.json({
      task: after,
    });
  }

  // Broadcast only after the transaction commits.

  emitToProject(
    projectId,
    'tasks:upsert',
    {
      tasks: [after],
    }
  );

  // Activity logging helper.

  const log = (action, meta) =>
    logActivity(
      { query },
      {
        projectId,
        taskId,
        user: req.user,
        action,
        meta: {
          title: after.title,
          ...meta,
        },
      }
    );

  // Record status changes.

  if (changed.includes('status')) {
    await log(
      'task.status_changed',
      {
        from: before.status,
        to: after.status,
      }
    );
  }

  // Record assignment changes.

  if (changed.includes('assigneeId')) {
    await log(
      'task.assigned',
      {
        from: before.assignee_name,
        to: after.assignee_name,
      }
    );
  }

  // Record other updated fields.

  const other = changed.filter(
    (key) =>
      !['status', 'assigneeId'].includes(key)
  );

  if (other.length) {
    await log(
      'task.updated',
      {
        fields: other,
      }
    );
  }

  res.json({
    task: after,
  });
}));

// ==========================================
// DRAG-AND-DROP TASK MOVEMENT
// ==========================================

/**
 * The client sends the destination status and index.
 *
 * The server rewrites positions for the affected
 * columns inside one transaction so that clients
 * receive the updated task ordering.
 */

router.patch('/:taskId/move', asyncHandler(async (req, res) => {
  const {
    projectId,
    taskId,
  } = req.params;

  const {
    status,
    index,
  } = parse(
    moveTaskSchema,
    req.body
  );

  const {
    tasks,
    from,
  } = await withTransaction(async (db) => {

    // Lock the task being moved.

    const {
      rows: [task],
    } = await db.query(
      `SELECT id, title, status
       FROM tasks
       WHERE id = $1
       AND project_id = $2
       FOR UPDATE`,
      [taskId, projectId]
    );

    if (!task) {
      throw new HttpError(
        404,
        'Task not found'
      );
    }

    // Retrieve destination column tasks.

    const {
      rows: siblings,
    } = await db.query(
      `SELECT id
       FROM tasks
       WHERE project_id = $1
       AND status = $2
       AND id <> $3
       ORDER BY position, created_at
       FOR UPDATE`,
      [projectId, status, taskId]
    );

    const ids = siblings.map(
      (row) => row.id
    );

    // Insert the moved task at the requested position.

    ids.splice(
      Math.min(index, ids.length),
      0,
      taskId
    );

    // Update destination column ordering.

    await db.query(
      `UPDATE tasks t
       SET position = v.ord - 1,
           status = $2,
           updated_at = CASE
             WHEN t.id = $3 THEN now()
             ELSE t.updated_at
           END
       FROM unnest($1::uuid[])
       WITH ORDINALITY AS v(id, ord)
       WHERE t.id = v.id`,
      [ids, status, taskId]
    );

    // Close the gap in the source column
    // when moving between different statuses.

    if (task.status !== status) {
      await db.query(
        `UPDATE tasks t
         SET position = v.ord - 1
         FROM (
           SELECT
             id,
             ROW_NUMBER() OVER (
               ORDER BY position, created_at
             ) AS ord
           FROM tasks
           WHERE project_id = $1
           AND status = $2
         ) v
         WHERE t.id = v.id`,
        [projectId, task.status]
      );
    }

    // Retrieve updated tasks from affected columns.

    const { rows } = await db.query(
      `${TASK_SELECT}
       WHERE t.project_id = $1
       AND t.status = ANY($2)
       ORDER BY t.position`,
      [
        projectId,
        [status, task.status],
      ]
    );

    return {
      tasks: rows,
      from: task,
    };
  });

  // Synchronize task ordering across connected clients.

  emitToProject(
    projectId,
    'tasks:upsert',
    {
      tasks,
    }
  );

  // Record activity only when the status changes.

  if (from.status !== status) {
    await logActivity(
      { query },
      {
        projectId,
        taskId,
        user: req.user,
        action: 'task.status_changed',
        meta: {
          title: from.title,
          from: from.status,
          to: status,
        },
      }
    );
  }

  res.json({
    tasks,
  });
}));

// ==========================================
// DELETE TASK
// ==========================================

router.delete('/:taskId', asyncHandler(async (req, res) => {
  const {
    projectId,
    taskId,
  } = req.params;

  const task = await getTask(
    { query },
    projectId,
    taskId
  );

  // Only the project owner or task creator
  // can delete a task.

  if (
    req.membership.role !== 'owner' &&
    task.created_by !== req.user.id
  ) {
    throw new HttpError(
      403,
      'Only the project owner or the task creator can delete this task'
    );
  }

  await query(
    `DELETE FROM tasks
     WHERE id = $1
     AND project_id = $2`,
    [taskId, projectId]
  );

  // Notify all connected project members.

  emitToProject(
    projectId,
    'task:deleted',
    {
      id: taskId,
    }
  );

  // Record task deletion activity.

  await logActivity(
    { query },
    {
      projectId,
      user: req.user,
      action: 'task.deleted',
      meta: {
        title: task.title,
      },
    }
  );

  res.status(204).end();
}));

// ==========================================
// EXPORT ROUTER
// ==========================================

export default router;
