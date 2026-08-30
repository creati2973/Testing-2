// SUPER_ADMIN_ID in the environment can be one ID or a comma-separated
// list of IDs, e.g. "8178921750, 8891301155". This parses that into a
// clean array of strings and checks membership properly (instead of
// comparing a single ID against the whole raw string, which always fails
// whenever more than one ID is configured).

function getSuperAdminIds() {
  const raw = process.env.SUPER_ADMIN_ID || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function isSuperAdmin(telegramId) {
  return getSuperAdminIds().includes(String(telegramId));
}

module.exports = { getSuperAdminIds, isSuperAdmin };
