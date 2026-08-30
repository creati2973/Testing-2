const pool = require('./pool');

async function createTopup(userId, amount) {
  const res = await pool.query(
    `INSERT INTO topups (user_id, amount, status)
     VALUES ($1, $2, 'awaiting_screenshot')
     RETURNING *`,
    [userId, amount]
  );
  return res.rows[0];
}

async function getTopup(id) {
  const res = await pool.query('SELECT * FROM topups WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function setTopupStatus(id, status, extra = {}) {
  const fields = ['status = $1', 'updated_at = now()'];
  const values = [status];
  let idx = 2;

  if (extra.screenshot_file_id !== undefined) {
    fields.push(`screenshot_file_id = $${idx++}`);
    values.push(extra.screenshot_file_id);
  }
  if (extra.admin_note !== undefined) {
    fields.push(`admin_note = $${idx++}`);
    values.push(extra.admin_note);
  }

  values.push(id);
  const res = await pool.query(
    `UPDATE topups SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return res.rows[0];
}

async function listTopupsByStatus(status, limit = 20) {
  const res = await pool.query(
    'SELECT * FROM topups WHERE status = $1 ORDER BY created_at ASC LIMIT $2',
    [status, limit]
  );
  return res.rows;
}

module.exports = { createTopup, getTopup, setTopupStatus, listTopupsByStatus };
