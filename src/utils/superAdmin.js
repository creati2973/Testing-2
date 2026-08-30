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

// ADMIN_CHAT_ID works the same way — one ID or a comma-separated list of
// chat IDs to notify (screenshots, key-delivery reminders, etc). Use
// notifyAdmins()/notifyAdminsWithPhoto() below to actually send to all of
// them instead of passing the raw env var straight into telegram.send*.
function getAdminChatIds() {
  const raw = process.env.ADMIN_CHAT_ID || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

async function notifyAdmins(telegram, text, extra = {}) {
  const ids = getAdminChatIds();
  await Promise.all(
    ids.map((id) =>
      telegram.sendMessage(id, text, extra).catch((err) => {
        console.error(`Failed to notify admin ${id}:`, err.message);
      })
    )
  );
}

async function notifyAdminsWithPhoto(telegram, fileId, extra = {}) {
  const ids = getAdminChatIds();
  await Promise.all(
    ids.map((id) =>
      telegram.sendPhoto(id, fileId, extra).catch((err) => {
        console.error(`Failed to notify admin ${id}:`, err.message);
      })
    )
  );
}

module.exports = {
  getSuperAdminIds,
  isSuperAdmin,
  getAdminChatIds,
  notifyAdmins,
  notifyAdminsWithPhoto
};
