require('dotenv').config();
const { Telegraf } = require('telegraf');
const runMigrations = require('../migrations/run');

async function main() {
  if (!process.env.BOT_TOKEN) {
    console.error('❌ Missing BOT_TOKEN in environment variables.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL in environment variables.');
    process.exit(1);
  }

  // Auto-create/update every table on every boot. Safe to run repeatedly —
  // uses CREATE TABLE IF NOT EXISTS, so this is the only "setup step" needed.
  // You never run a migration command yourself; this handles it.
  await runMigrations();

  const userHandlers = require('./handlers/user');
  const adminHandlers = require('./handlers/admin');

  const bot = new Telegraf(process.env.BOT_TOKEN);

  // Register admin routes BEFORE user routes so admin-only text/photo
  // multi-step flows get first refusal, falling through to user flows
  // via next() when the sender isn't an admin.
  adminHandlers.register(bot);
  userHandlers.register(bot);

  bot.catch((err, ctx) => {
    console.error(`Error while handling update ${ctx.update.update_id}:`, err);
  });

  await bot.launch();
  console.log('✅ NexsusMod Store bot is running.');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
