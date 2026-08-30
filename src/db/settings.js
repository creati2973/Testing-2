const pool = require('./pool');

async function getSettings() {
  const res = await pool.query('SELECT * FROM admin_settings ORDER BY id ASC LIMIT 1');
  return res.rows[0] || null;
}

async function updateSettings(fields) {
  const current = await getSettings();

  const merged = {
    upi_id: fields.upi_id !== undefined ? fields.upi_id : current?.upi_id,
    qr_file_id: fields.qr_file_id !== undefined ? fields.qr_file_id : current?.qr_file_id,
    support_contact: fields.support_contact !== undefined ? fields.support_contact : current?.support_contact,
    support_link: fields.support_link !== undefined ? fields.support_link : current?.support_link,
    update_channel_link: fields.update_channel_link !== undefined ? fields.update_channel_link : current?.update_channel_link,
    howto_link: fields.howto_link !== undefined ? fields.howto_link : current?.howto_link
  };

  const res = await pool.query(
    `UPDATE admin_settings
     SET upi_id = $1, qr_file_id = $2, support_contact = $3,
         support_link = $4, update_channel_link = $5, howto_link = $6,
         updated_at = now()
     WHERE id = $7 RETURNING *`,
    [
      merged.upi_id,
      merged.qr_file_id,
      merged.support_contact,
      merged.support_link,
      merged.update_channel_link,
      merged.howto_link,
      current.id
    ]
  );
  return res.rows[0];
}

module.exports = { getSettings, updateSettings };
