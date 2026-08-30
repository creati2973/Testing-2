const users = require('../db/users');
const catalog = require('../db/catalog');
const ordersDb = require('../db/orders');
const settingsDb = require('../db/settings');
const kb = require('../utils/keyboards');
const state = require('../utils/state');
const { isSuperAdmin } = require('../utils/superAdmin');

async function requireAdmin(ctx, next) {
  const isAdmin =
    (await users.isAdmin(ctx.from.id)) || isSuperAdmin(ctx.from.id);
  if (!isAdmin) {
    if (ctx.updateType === 'callback_query') await ctx.answerCbQuery('⛔ Admins only.');
    else await ctx.reply('⛔ Admins only.');
    return;
  }
  return next();
}

function register(bot) {
  // ---- /admin panel ----
  bot.command('admin', requireAdmin, async (ctx) => {
    await ctx.reply('🛠 *Admin Panel*', { parse_mode: 'Markdown', ...kb.adminPanelMenu() });
  });

  bot.action('admin:panel', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('🛠 *Admin Panel*', { parse_mode: 'Markdown', ...kb.adminPanelMenu() });
  });

  // ---- Approve / Reject payment ----
  bot.action(/^admin:approve:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const orderId = Number(ctx.match[1]);
    const order = await ordersDb.getOrder(orderId);
    if (!order) return ctx.reply('⚠️ Order not found.');
    if (order.status !== 'verifying') {
      return ctx.reply(`⚠️ Order #${orderId} is not awaiting verification (status: ${order.status}).`);
    }

    await users.creditBalance(order.user_id, Number(order.amount), 'purchase_topup', `Payment approved for order #${orderId}`, orderId);
    await users.debitBalance(order.user_id, Number(order.amount), 'purchase', `Purchase: ${order.plan_name}`, orderId);
    await ordersDb.setOrderStatus(orderId, 'approved');

    await ctx.editMessageCaption(
      `✅ Order #${orderId} approved by admin.`,
      {}
    ).catch(() => {});

    await ctx.telegram.sendMessage(
      order.user_id,
      `✅ Payment verified! *Generating your key, please wait...*`,
      { parse_mode: 'Markdown' }
    );

    // Notify admin(s) that a key needs to be delivered
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await ctx.telegram.sendMessage(
        adminChatId,
        `🔑 Order #${orderId} approved — key delivery needed.\n` +
        `Product: ${order.category_name} — ${order.plan_name}\n\n` +
        `Reply to THIS message with the account/key details to send to the customer,\n` +
        `or use /deliver ${orderId} <content>`,
        { reply_markup: { force_reply: true } }
      );
    }
  });

  bot.action(/^admin:reject:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const orderId = Number(ctx.match[1]);
    const order = await ordersDb.getOrder(orderId);
    if (!order) return ctx.reply('⚠️ Order not found.');

    await ordersDb.setOrderStatus(orderId, 'rejected');
    await ctx.editMessageCaption(`❌ Order #${orderId} rejected.`, {}).catch(() => {});

    await ctx.telegram.sendMessage(
      order.user_id,
      `❌ Your payment for order #${orderId} could not be verified. Please contact support if this is a mistake.`
    );
  });

  // ---- Key delivery via command: /deliver <orderId> <content...> ----
  bot.command('deliver', requireAdmin, async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const orderId = Number(parts[1]);
    const content = parts.slice(2).join(' ');

    if (!orderId || !content) {
      return ctx.reply('Usage: /deliver <orderId> <key or account details>');
    }

    const order = await ordersDb.getOrder(orderId);
    if (!order) return ctx.reply('⚠️ Order not found.');

    await ordersDb.setOrderStatus(orderId, 'fulfilled', { delivered_content: content });

    await ctx.telegram.sendMessage(
      order.user_id,
      `🔑 *Your order is ready!*\n\n` +
      `Product: ${order.category_name} — ${order.plan_name}\n\n` +
      `${content}\n\n` +
      `Thank you for shopping with NexsusMod Store! 🙂`,
      { parse_mode: 'Markdown' }
    );

    await ctx.reply(`✅ Delivered order #${orderId} to user.`);
  });

  // ---- Pending orders / pending keys list ----
  bot.action('admin:pending', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const pending = await ordersDb.listOrdersByStatus('verifying', 20);
    if (!pending.length) return ctx.reply('No orders pending verification. ✅');

    let text = '🧾 *Pending Verification:*\n\n';
    pending.forEach((o) => {
      text += `#${o.id} — ${o.category_name} / ${o.plan_name} — ₹${o.amount}\n`;
    });
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.action('admin:pendingkeys', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const approved = await ordersDb.listOrdersByStatus('approved', 20);
    if (!approved.length) return ctx.reply('No pending key deliveries. ✅');

    let text = '🔑 *Awaiting Key Delivery:*\n\n';
    approved.forEach((o) => {
      text += `#${o.id} — ${o.category_name} / ${o.plan_name} — use /deliver ${o.id} <content>\n`;
    });
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  // ---- Category management ----
  bot.action('admin:addcat', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    state.set(ctx.from.id, { action: 'admin_addcat_name' });
    await ctx.reply('📦 Send the new category name (e.g. "Netflix"):');
  });

  bot.action('admin:addplan', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const categories = await catalog.listAllCategories();
    if (!categories.length) return ctx.reply('⚠️ Add a category first.');

    const { Markup } = require('telegraf');
    const buttons = categories.map((c) => [
      Markup.button.callback(`${c.emoji} ${c.name}${c.is_active ? '' : ' (inactive)'}`, `admin:addplan:cat:${c.id}`)
    ]);
    await ctx.reply('📦 Which category is this plan for?', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^admin:addplan:cat:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = Number(ctx.match[1]);
    state.set(ctx.from.id, { action: 'admin_addplan_name', categoryId });
    await ctx.reply('🏷 Send the plan name (e.g. "1 Week"):');
  });

  bot.action('admin:toggle', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const categories = await catalog.listAllCategories();
    const { Markup } = require('telegraf');
    const buttons = categories.map((c) => [
      Markup.button.callback(
        `${c.is_active ? '🟢' : '🔴'} ${c.name} (category)`,
        `admin:togglecat:${c.id}`
      )
    ]);
    buttons.push([Markup.button.callback('View plans to toggle instead ▸', 'admin:toggleplans')]);
    await ctx.reply('Tap a category to toggle its availability:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^admin:togglecat:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = Number(ctx.match[1]);
    const category = await catalog.getCategory(categoryId);
    await catalog.setCategoryActive(categoryId, !category.is_active);
    await ctx.reply(`${!category.is_active ? '🟢 Enabled' : '🔴 Disabled'}: ${category.name}`);
  });

  bot.action('admin:toggleplans', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const categories = await catalog.listAllCategories();
    const { Markup } = require('telegraf');
    const buttons = categories.map((c) => [
      Markup.button.callback(`${c.emoji} ${c.name}`, `admin:toggleplans:cat:${c.id}`)
    ]);
    await ctx.reply('Pick a category to see its plans:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^admin:toggleplans:cat:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = Number(ctx.match[1]);
    const plans = await catalog.listAllPlans(categoryId);
    if (!plans.length) return ctx.reply('No plans in this category yet.');

    const { Markup } = require('telegraf');
    const buttons = plans.map((p) => [
      Markup.button.callback(`${p.is_active ? '🟢' : '🔴'} ${p.name} — ₹${p.price}`, `admin:toggleplan:${p.id}`)
    ]);
    await ctx.reply('Tap a plan to toggle availability:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^admin:toggleplan:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const planId = Number(ctx.match[1]);
    const plan = await catalog.getPlan(planId);
    await catalog.setPlanActive(planId, !plan.is_active);
    await ctx.reply(`${!plan.is_active ? '🟢 Enabled' : '🔴 Disabled'}: ${plan.name}`);
  });

  // ---- QR / UPI setup ----
  bot.action('admin:setqr', requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    state.set(ctx.from.id, { action: 'admin_setqr_photo' });
    await ctx.reply('🖼 Send the new UPI QR code image now:');
  });

  // ---- Text message router for multi-step admin flows ----
  bot.on('text', async (ctx, next) => {
    const s = state.get(ctx.from.id);
    if (!s) return next();

    const isAdminUser =
      (await users.isAdmin(ctx.from.id)) || isSuperAdmin(ctx.from.id);
    if (!isAdminUser) return next();

    if (s.action === 'admin_addcat_name') {
      const name = ctx.message.text.trim();
      const category = await catalog.createCategory(name);
      state.clear(ctx.from.id);
      return ctx.reply(`✅ Category created: ${category.name} (id ${category.id}). It's active by default.`);
    }

    if (s.action === 'admin_addplan_name') {
      state.set(ctx.from.id, { ...s, action: 'admin_addplan_duration', planName: ctx.message.text.trim() });
      return ctx.reply('⏱ Send the duration label (e.g. "7 days"), or "-" to skip:');
    }

    if (s.action === 'admin_addplan_duration') {
      const duration = ctx.message.text.trim();
      state.set(ctx.from.id, {
        ...s,
        action: 'admin_addplan_price',
        durationLabel: duration === '-' ? null : duration
      });
      return ctx.reply('💰 Send the price in ₹ (numbers only, e.g. 49):');
    }

    if (s.action === 'admin_addplan_price') {
      const price = parseFloat(ctx.message.text.trim());
      if (isNaN(price)) return ctx.reply('⚠️ Please send a valid number for price.');

      const plan = await catalog.createPlan(s.categoryId, s.planName, s.durationLabel, price);
      state.clear(ctx.from.id);
      return ctx.reply(`✅ Plan created: ${plan.name} — ₹${plan.price}. It's active by default.`);
    }

    if (s.action === 'admin_setupi_text') {
      const upiId = ctx.message.text.trim();
      await settingsDb.updateSettings({ upi_id: upiId });
      state.clear(ctx.from.id);
      return ctx.reply(`✅ UPI ID updated to: ${upiId}`);
    }

    return next();
  });

  // ---- QR photo capture ----
  bot.on('photo', async (ctx, next) => {
    const s = state.get(ctx.from.id);
    if (!s || s.action !== 'admin_setqr_photo') return next();

    const isAdminUser =
      (await users.isAdmin(ctx.from.id)) || isSuperAdmin(ctx.from.id);
    if (!isAdminUser) return next();

    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    await settingsDb.updateSettings({ qr_file_id: fileId });
    state.set(ctx.from.id, { action: 'admin_setupi_text' });
    await ctx.reply('✅ QR saved! Now send the UPI ID text (e.g. yourstore@upi):');
  });
}

module.exports = { register, requireAdmin };
