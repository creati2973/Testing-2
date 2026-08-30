const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function runMigrations() {
  const file = path.join(__dirname, '001_init.sql');
  const sql = fs.readFileSync(file, 'utf8');

  console.log('🔧 Ensuring database schema is up to date...');
  await pool.query(sql);
  console.log('✅ Database schema ready.');
}

// Allow `node migrations/run.js` to still work standalone if ever needed,
// but this is no longer a required manual step — src/index.js calls this
// automatically on every boot.
if (require.main === module) {
  require('dotenv').config();
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;
