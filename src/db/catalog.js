const pool = require('./pool');

// ---- Categories ----

async function listActiveCategories() {
  const res = await pool.query(
    'SELECT * FROM categories WHERE is_active = true ORDER BY sort_order ASC, id ASC'
  );
  return res.rows;
}

async function listAllCategories() {
  const res = await pool.query(
    'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
  );
  return res.rows;
}

async function getCategory(id) {
  const res = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function createCategory(name, emoji = '📦') {
  const res = await pool.query(
    'INSERT INTO categories (name, emoji) VALUES ($1, $2) RETURNING *',
    [name, emoji]
  );
  return res.rows[0];
}

async function setCategoryActive(id, isActive) {
  await pool.query('UPDATE categories SET is_active = $1 WHERE id = $2', [isActive, id]);
}

async function deleteCategory(id) {
  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
}

// ---- Plans (sub-categories) ----

async function listActivePlans(categoryId) {
  const res = await pool.query(
    `SELECT * FROM plans WHERE category_id = $1 AND is_active = true
     ORDER BY sort_order ASC, id ASC`,
    [categoryId]
  );
  return res.rows;
}

async function listAllPlans(categoryId) {
  const res = await pool.query(
    'SELECT * FROM plans WHERE category_id = $1 ORDER BY sort_order ASC, id ASC',
    [categoryId]
  );
  return res.rows;
}

async function getPlan(id) {
  const res = await pool.query(
    `SELECT plans.*, categories.name AS category_name
     FROM plans JOIN categories ON categories.id = plans.category_id
     WHERE plans.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function createPlan(categoryId, name, durationLabel, price) {
  const res = await pool.query(
    `INSERT INTO plans (category_id, name, duration_label, price)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [categoryId, name, durationLabel, price]
  );
  return res.rows[0];
}

async function setPlanActive(id, isActive) {
  await pool.query('UPDATE plans SET is_active = $1 WHERE id = $2', [isActive, id]);
}

async function deletePlan(id) {
  await pool.query('DELETE FROM plans WHERE id = $1', [id]);
}

module.exports = {
  listActiveCategories,
  listAllCategories,
  getCategory,
  createCategory,
  setCategoryActive,
  deleteCategory,
  listActivePlans,
  listAllPlans,
  getPlan,
  createPlan,
  setPlanActive,
  deletePlan
};
