const pool = require('./pool');

function genReferralCode(telegramId) {
  return `REF${telegramId}`;
}

async function getOrCreateUser(tgUser, referredByCode) {
  const { id: telegram_id, username, first_name } = tgUser;

  const existing = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegram_id]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  let referredBy = null;
  if (referredByCode) {
    const ref = await pool.query(
      'SELECT telegram_id FROM users WHERE referral_code = $1',
      [referredByCode]
    );
    if (ref.rows.length > 0) referredBy = ref.rows[0].telegram_id;
  }

  const referral_code = genReferralCode(telegram_id);

  const inserted = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [telegram_id, username || null, first_name || null, referral_code, referredBy]
  );

  // Referral bonus: credit referrer a small amount (configurable)
  if (referredBy) {
    const REFERRAL_BONUS = 10;
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
      [REFERRAL_BONUS, referredBy]
    );
    await pool.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, note)
       VALUES ($1, $2, 'referral', $3)`,
      [referredBy, REFERRAL_BONUS, `Referral bonus for inviting ${telegram_id}`]
    );
  }

  return inserted.rows[0];
}

async function getUser(telegramId) {
  const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return res.rows[0] || null;
}

async function creditBalance(telegramId, amount, type, note, orderId = null) {
  await pool.query('BEGIN');
  try {
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE telegram_id = $2',
      [amount, telegramId]
    );
    await pool.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, note, order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [telegramId, amount, type, note, orderId]
    );
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

async function debitBalance(telegramId, amount, type, note, orderId = null) {
  return creditBalance(telegramId, -Math.abs(amount), type, note, orderId);
}

async function getWalletHistory(telegramId, limit = 10) {
  const res = await pool.query(
    `SELECT * FROM wallet_transactions WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [telegramId, limit]
  );
  return res.rows;
}

async function getOrderHistory(telegramId, limit = 10) {
  const res = await pool.query(
    `SELECT * FROM orders WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [telegramId, limit]
  );
  return res.rows;
}

async function isAdmin(telegramId) {
  const res = await pool.query('SELECT 1 FROM admins WHERE telegram_id = $1', [telegramId]);
  return res.rows.length > 0;
}

module.exports = {
  getOrCreateUser,
  getUser,
  creditBalance,
  debitBalance,
  getWalletHistory,
  getOrderHistory,
  isAdmin
};
