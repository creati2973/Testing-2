// Lightweight in-memory "what is this user in the middle of doing" tracker.
// Good enough for a single-instance Railway deployment. If you later scale
// to multiple instances, move this to a Redis/Postgres-backed store instead.

const state = new Map();

function set(telegramId, data) {
  state.set(telegramId, { ...data, updatedAt: Date.now() });
}

function get(telegramId) {
  return state.get(telegramId) || null;
}

function clear(telegramId) {
  state.delete(telegramId);
}

module.exports = { set, get, clear };
