const pool = require('./pool');

async function getSettings() {
  const res = await pool.query('SELECT * FROM admin_settings ORDER BY id ASC LIMIT 1');
  return res.rows[0] || null;
}

async function updateSettings({ upi_id, qr_file_id, support_contact }) {
  const current = await getSettings();
  const merged = {
    upi_id: upi_id !== undefined ? upi_id : current?.upi_id,
    qr_file_id: qr_file_id !== undefined ? qr_file_id : current?.qr_file_id,
    support_contact: support_contact !== undefined ? support_contact : current?.support_contact
  };

  const res = await pool.query(
    `UPDATE admin_settings SET upi_id = $1, qr_file_id = $2, support_contact = $3, updated_at = now()
     WHERE id = $4 RETURNING *`,
    [merged.upi_id, merged.qr_file_id, merged.support_contact, current.id]
  );
  return res.rows[0];
}

module.exports = { getSettings, updateSettings };
