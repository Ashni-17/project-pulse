import { query } from '../config/db.js';
import { HttpError } from '../utils/errors.js';
import { computeStats } from '../utils/stats.js';


// Fetch authorized project information
export async function getProjectAIContext(
  projectId,
  userId
) {
  const { rows: [project] } = await query(
    `SELECT p.id, p.name, p.description
     FROM projects p
     JOIN project_members pm
       ON pm.project_id = p.id
     WHERE p.id = $1
       AND pm.user_id = $2`,
    [projectId, userId]
  );

  if (!project) {
    throw new HttpError(404, 'Project not found');
  }


  // Retrieve project tasks, members and recent activity
  const [
    taskResult,
    memberResult,
    activityResult,
  ] = await Promise.all([

    query(
      `SELECT
         t.id,
         t.title,
         t.description,
         t.status,
         t.priority,
         t.assignee_id,
         u.name AS assignee_name,
         t.due_date,
         t.created_at,
         t.updated_at
       FROM tasks t
       LEFT JOIN users u
         ON u.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.created_at ASC`,
      [projectId]
    ),

    query(
      `SELECT
         u.id,
         u.name,
         pm.role
       FROM project_members pm
       JOIN users u
         ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.name`,
      [projectId]
    ),

    query(
      `SELECT
         a.action,
         a.task_id,
         t.title AS task_title,
         u.name AS user_name,
         a.created_at
       FROM activities a
       LEFT JOIN users u
         ON u.id = a.user_id
       LEFT JOIN tasks t
         ON t.id = a.task_id
       WHERE a.project_id = $1
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [projectId]
    ),

  ]);


  const tasks = taskResult.rows;
  const currentDate = new Date()
    .toISOString()
    .slice(0, 10);


  // Reuse existing dashboard calculations
  const statistics = computeStats(
    tasks,
    currentDate
  );


  // Calculate individual member workload
  const members = memberResult.rows.map(member => {

    const assignedTasks = tasks.filter(
      task => task.assignee_id === member.id
    );

    const activeTasks = assignedTasks.filter(
      task => task.status !== 'done'
    );

    return {
      id: member.id,
      name: member.name,
      role: member.role,

      totalTasks: assignedTasks.length,

      activeTasks: activeTasks.length,

      todoTasks: assignedTasks.filter(
        task => task.status === 'todo'
      ).length,

      inProgressTasks: assignedTasks.filter(
        task => task.status === 'in_progress'
      ).length,

      completedTasks: assignedTasks.filter(
        task => task.status === 'done'
      ).length,

      highPriorityTasks: activeTasks.filter(
        task => task.priority === 'high'
      ).length,

      overdueTasks: activeTasks.filter(
        task =>
          task.due_date &&
          task.due_date < currentDate
      ).length,
    };
  });


  return {
    projectName: project.name,
    projectDescription: project.description || '',
    currentDate,
    statistics,
    tasks,
    members,
    activities: activityResult.rows,
  };
}


// Find a task only within the authorized project
export function getAIContextTask(context, taskId) {

  const task = context.tasks.find(
    item => item.id === taskId
  );

  if (!task) {
    throw new HttpError(404, 'Task not found');
  }

  return task;
}