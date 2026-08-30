const pool = require('./pool');

async function createOrder(userId, plan) {
  const res = await pool.query(
    `INSERT INTO orders (user_id, plan_id, category_name, plan_name, amount, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [userId, plan.id, plan.category_name, plan.name, plan.price]
  );
  return res.rows[0];
}

async function getOrder(id) {
  const res = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function setOrderStatus(id, status, extra = {}) {
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
  if (extra.delivered_content !== undefined) {
    fields.push(`delivered_content = $${idx++}`);
    values.push(extra.delivered_content);
  }

  values.push(id);
  const res = await pool.query(
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return res.rows[0];
}

async function listOrdersByStatus(status, limit = 20) {
  const res = await pool.query(
    'SELECT * FROM orders WHERE status = $1 ORDER BY created_at ASC LIMIT $2',
    [status, limit]
  );
  return res.rows;
}

module.exports = {
  createOrder,
  getOrder,
  setOrderStatus,
  listOrdersByStatus
};
