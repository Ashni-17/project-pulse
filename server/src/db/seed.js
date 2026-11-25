// Creates two demo accounts and a sample project so reviewers can test collaboration immediately.
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

const password = await bcrypt.hash('Password123', 12);
const upsertUser = async (name, email) =>
  (await pool.query(
    `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name, email, password],
  )).rows[0].id;

const alice = await upsertUser('Alice Carter', 'alice@example.com');
const bob = await upsertUser('Bob Mehta', 'bob@example.com');

const existing = await pool.query(`SELECT id FROM projects WHERE owner_id=$1 AND name='Product Launch'`, [alice]);
if (!existing.rows[0]) {
  const { rows: [project] } = await pool.query(
    `INSERT INTO projects(name,description,owner_id) VALUES('Product Launch','Everything we need to ship v1.',$1) RETURNING id`, [alice]);
  await pool.query(`INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'member')`, [project.id, alice, bob]);
  const tasks = [
    ['Develop landing page', 'todo', 'high', bob, 0], ['Write launch announcement', 'todo', 'medium', alice, 1],
    ['Set up analytics', 'in_progress', 'medium', bob, 0], ['Finalize pricing', 'done', 'low', alice, 0],
  ];
  for (const [title, status, priority, assignee, position] of tasks) {
    await pool.query(
      `INSERT INTO tasks(project_id,title,status,priority,assignee_id,position,created_by,due_date)
       VALUES($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE + 5)`, [project.id, title, status, priority, assignee, position, alice]);
  }
}
console.log('✔ Seeded. Log in as alice@example.com or bob@example.com (password: Password123)');
await pool.end();
