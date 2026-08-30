const { Markup } = require('telegraf');
const users = require('../db/users');
const catalog = require('../db/catalog');
const ordersDb = require('../db/orders');
const topupsDb = require('../db/topups');
const settingsDb = require('../db/settings');
const kb = require('../utils/keyboards');
const state = require('../utils/state');

const STORE_NAME = 'NexsusMod Store';
const DAILY_GIFT_MIN = 0;
const DAILY_GIFT_MAX = 1;
const DAILY_GIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function register(bot) {
  // ---- /start ----
  bot.start(async (ctx) => {
    const payload = ctx.startPayload; // referral code if present
    const user = await users.getOrCreateUser(ctx.from, payload || null);

    const text =
      `🙂 *${STORE_NAME.toUpperCase()}*\n\n` +
      `┣ 🛒 *Buy Now* : All Key Purchase & Instant Delivery\n` +
      `┣ 📥 *Check Update* : Check Setup Video And Update Info\n` +
      `┣ 💵 *Add Balance* : Deposit Balance & Secure UPI Payment System\n` +
      `┣ 👑 *My Profile + All History* : Check Your Account Info + All History\n` +
      `┣ 🔗 *Refer And Earn* : Share Refer Link & Earn Money\n` +
      `┣ ❗ *How To Use Bot* : View Tutorial And How To Use This Bot\n` +
      `┣ 📩 *Support* : Bot Problem? Contact Support Admin\n` +
      `┣ 🎁 *Daily Gift* : Free Spin, Win Random Balance Daily (once per 24h)\n\n` +
      `💰 *Your Balance:* ₹${Number(user.balance).toFixed(2)}\n\n` +
      `👇 Select an option from the menu below:`;

    await ctx.replyWithMarkdown(text, kb.mainMenu());
  });

  // ---- Main menu router ----
  bot.action('menu:main', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await users.getUser(ctx.from.id);
    await ctx.editMessageText(
      `💰 *Your Balance:* ₹${Number(user.balance).toFixed(2)}\n\n👇 Select an option from the menu below:`,
      { parse_mode: 'Markdown', ...kb.mainMenu() }
    );
  });

  bot.action('menu:buy', async (ctx) => {
    await ctx.answerCbQuery();
    const categories = await catalog.listActiveCategories();
    if (categories.length === 0) {
      return ctx.editMessageText(
        '🛒 No products available right now. Please check back later.',
        kb.mainMenu()
      );
    }
    await ctx.editMessageText('🛒 Choose a product from the list below:', kb.categoryList(categories));
  });

  bot.action(/^cat:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = Number(ctx.match[1]);
    const plans = await catalog.listActivePlans(categoryId);
    const category = await catalog.getCategory(categoryId);

    if (!plans.length) {
      return ctx.editMessageText(
        `📦 *${category?.name || 'Product'}*\n\nNo active plans right now.`,
        { parse_mode: 'Markdown', ...kb.categoryList(await catalog.listActiveCategories()) }
      );
    }

    let text = `📦 *${category.name}*\n\nChoose your access plan:\n\n`;
    plans.forEach((p) => {
      text += `┣ 💰 ₹${Number(p.price).toFixed(2)} — 🛒 ${p.name}${p.duration_label ? ` (${p.duration_label})` : ''}\n`;
    });

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb.planList(plans, categoryId) });
  });

  bot.action(/^plan:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const planId = Number(ctx.match[1]);
    const plan = await catalog.getPlan(planId);
    if (!plan || !plan.is_active) {
      return ctx.editMessageText('⚠️ This plan is no longer available.', kb.mainMenu());
    }

    const user = await users.getUser(ctx.from.id);
    const order = await ordersDb.createOrder(ctx.from.id, plan);

    if (Number(user.balance) >= Number(plan.price)) {
      // Enough balance — offer direct wallet purchase too
      const text =
        `🧾 *ORDER SUMMARY*\n\n` +
        `Product: ${plan.category_name}\n` +
        `Plan: ${plan.name}\n` +
        `Price: 💰 ₹${Number(plan.price).toFixed(2)}\n` +
        `Your Balance: 💰 ₹${Number(user.balance).toFixed(2)}\n\n` +
        `Select payment method below:`;
      return ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb.confirmPayment(order.id) });
    }

    const deficit = Number(plan.price) - Number(user.balance);
    const text =
      `🧾 *INSUFFICIENT BALANCE*\n\n` +
      `Product: ${plan.category_name}\n` +
      `Plan: ${plan.name}\n` +
      `Price: 💰 ₹${Number(plan.price).toFixed(2)}\n` +
      `Your Balance: 💰 ₹${Number(user.balance).toFixed(2)}\n` +
      `Deficit Need: 💰 ₹${deficit.toFixed(2)}\n\n` +
      `Select payment method below:`;

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb.confirmPayment(order.id) });
  });

  // ---- Payment (UPI only) ----
  bot.action(/^pay:upi:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const orderId = Number(ctx.match[1]);
    const order = await ordersDb.getOrder(orderId);
    if (!order) return ctx.reply('⚠️ Order not found.');

    const settings = await settingsDb.getSettings();
    if (!settings?.qr_file_id) {
      return ctx.reply('⚠️ Payment QR is not configured yet. Please contact support.');
    }

    await ordersDb.setOrderStatus(orderId, 'awaiting_screenshot');

    const caption =
      `👇 *${STORE_NAME.toUpperCase()} — UPI QR ACTIVE*\n\n` +
      `Merchant Name: ${STORE_NAME}\n\n` +
      `Scan & pay exactly 💰 ₹${Number(order.amount).toFixed(2)}\n\n` +
      `Tap verify below after completing payment.\n\n` +
      `🧾 Session expires in 15 minutes.`;

    await ctx.replyWithPhoto(settings.qr_file_id, {
      caption,
      parse_mode: 'Markdown',
      ...kb.verifyOrCancel(orderId)
    });
  });

  bot.action(/^cancel:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const orderId = Number(ctx.match[1]);
    await ordersDb.setOrderStatus(orderId, 'cancelled');
    await ctx.editMessageCaption('❌ Order cancelled.', kb.mainMenu());
  });

  bot.action(/^verify:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const orderId = Number(ctx.match[1]);
    const order = await ordersDb.getOrder(orderId);
    if (!order) return ctx.reply('⚠️ Order not found.');

    state.set(ctx.from.id, { action: 'awaiting_screenshot', orderId });
    await ctx.reply('📸 Please send a screenshot of your payment now.');
  });

  // ---- Screenshot capture (photo message while awaiting_screenshot) ----
  bot.on('photo', async (ctx, next) => {
    const s = state.get(ctx.from.id);
    if (!s || s.action !== 'awaiting_screenshot') return next();

    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const order = await ordersDb.getOrder(s.orderId);
    if (!order) {
      state.clear(ctx.from.id);
      return ctx.reply('⚠️ Order not found, please start again.');
    }

    await ordersDb.setOrderStatus(order.id, 'verifying', { screenshot_file_id: fileId });
    state.clear(ctx.from.id);

    await ctx.reply(
      '✅ Screenshot received! Your payment is being verified by our admin team. ' +
      'You will be notified shortly.'
    );

    // Notify admin group/chat — sends to every ID in ADMIN_CHAT_ID
    const kbMod = require('../utils/keyboards');
    const { notifyAdminsWithPhoto } = require('../utils/superAdmin');
    await notifyAdminsWithPhoto(ctx.telegram, fileId, {
      caption:
        `🧾 *Payment Verification Needed*\n\n` +
        `Order #${order.id}\n` +
        `User: ${ctx.from.username ? '@' + ctx.from.username : ctx.from.id}\n` +
        `Product: ${order.category_name}\n` +
        `Plan: ${order.plan_name}\n` +
        `Amount: ₹${Number(order.amount).toFixed(2)}`,
      parse_mode: 'Markdown',
      ...kbMod.adminApproveReject(order.id)
    });
  });

  // ---- Profile + History ----
  bot.action('menu:profile', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await users.getUser(ctx.from.id);
    const orderHistory = await users.getOrderHistory(ctx.from.id, 5);

    let text =
      `👑 *YOUR PROFILE*\n\n` +
      `Telegram ID: ${user.telegram_id}\n` +
      `Username: ${user.username ? '@' + user.username : '—'}\n` +
      `Tier: ${user.tier}\n` +
      `Balance: 💰 ₹${Number(user.balance).toFixed(2)}\n` +
      `Member since: ${new Date(user.created_at).toDateString()}\n\n` +
      `📜 *Recent Orders:*\n`;

    if (orderHistory.length === 0) {
      text += '_No orders yet._';
    } else {
      orderHistory.forEach((o) => {
        text += `┣ #${o.id} ${o.category_name} - ${o.plan_name} — ₹${Number(o.amount).toFixed(2)} [${o.status}]\n`;
      });
    }

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb.mainMenu() });
  });

  // ---- Refer and Earn ----
  bot.action('menu:refer', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await users.getUser(ctx.from.id);
    const botInfo = await ctx.telegram.getMe();
    const link = `https://t.me/${botInfo.username}?start=${user.referral_code}`;

    const text =
      `🔗 *REFER AND EARN*\n\n` +
      `Share your referral link. When someone joins using it, you earn a bonus!\n\n` +
      `Your link:\n\`${link}\``;

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb.mainMenu() });
  });

  // ---- How to use / Check update / Support ----
  bot.action('menu:howto', async (ctx) => {
    await ctx.answerCbQuery();
    const settings = await settingsDb.getSettings();

    const text =
      '❗ *HOW TO USE BOT*\n\n' +
      '1️⃣ Tap Buy Now\n' +
      '2️⃣ Select a product category\n' +
      '3️⃣ Select a plan\n' +
      '4️⃣ Pay via UPI QR shown\n' +
      '5️⃣ Tap Verify Payment & send screenshot\n' +
      '6️⃣ Wait for admin approval\n' +
      '7️⃣ Receive your key/account details right here in chat!' +
      (settings?.howto_link ? '\n\n📺 Full video tutorial below.' : '');

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...(settings?.howto_link ? kb.mainMenuWithLink(settings.howto_link, '📺 Watch Tutorial') : kb.mainMenu())
    });
  });

  bot.action('menu:update', async (ctx) => {
    await ctx.answerCbQuery();
    const settings = await settingsDb.getSettings();

    const text = settings?.update_channel_link
      ? '📥 *CHECK UPDATE*\n\nTap below to view the latest updates and setup videos.'
      : '📥 *CHECK UPDATE*\n\nNo update channel has been configured yet. Check back soon!';

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...(settings?.update_channel_link ? kb.mainMenuWithLink(settings.update_channel_link, '📥 Open Updates Channel') : kb.mainMenu())
    });
  });

  bot.action('menu:support', async (ctx) => {
    await ctx.answerCbQuery();
    const settings = await settingsDb.getSettings();
    const contactLabel = settings?.support_contact || '@NexsusModSupport';

    await ctx.editMessageText(
      `📩 *SUPPORT*\n\nHaving an issue? Contact us: ${contactLabel}`,
      {
        parse_mode: 'Markdown',
        ...(settings?.support_link ? kb.mainMenuWithLink(settings.support_link, '📩 Contact Support') : kb.mainMenu())
      }
    );
  });

  bot.action('menu:addbalance', async (ctx) => {
    await ctx.answerCbQuery();
    state.set(ctx.from.id, { action: 'awaiting_topup_amount' });
    await ctx.editMessageText(
      '💵 *ADD BALANCE*\n\nHow much would you like to add to your wallet? ' +
      'Reply with an amount in ₹ (e.g. `100`).',
      { parse_mode: 'Markdown' }
    );
  });

  // ---- Add Balance: amount entry (text) ----
  bot.on('text', async (ctx, next) => {
    const s = state.get(ctx.from.id);
    if (!s || s.action !== 'awaiting_topup_amount') return next();

    const amount = parseFloat(ctx.message.text.trim());
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('⚠️ Please send a valid amount greater than 0 (e.g. 100).');
    }

    const settings = await settingsDb.getSettings();
    if (!settings?.qr_file_id) {
      state.clear(ctx.from.id);
      return ctx.reply('⚠️ Payment QR is not configured yet. Please contact support.');
    }

    const topup = await topupsDb.createTopup(ctx.from.id, amount);
    state.set(ctx.from.id, { action: 'awaiting_topup_screenshot', topupId: topup.id });

    const caption =
      `👇 *${STORE_NAME.toUpperCase()} — UPI QR ACTIVE*\n\n` +
      `Merchant Name: ${STORE_NAME}\n\n` +
      `Scan & pay exactly 💰 ₹${amount.toFixed(2)}\n\n` +
      `Once paid, send a screenshot of the payment here.\n\n` +
      `🧾 Session expires in 15 minutes.`;

    await ctx.replyWithPhoto(settings.qr_file_id, { caption, parse_mode: 'Markdown' });
  });

  // ---- Add Balance: screenshot capture ----
  bot.on('photo', async (ctx, next) => {
    const s = state.get(ctx.from.id);
    if (!s || s.action !== 'awaiting_topup_screenshot') return next();

    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const topup = await topupsDb.getTopup(s.topupId);
    if (!topup) {
      state.clear(ctx.from.id);
      return ctx.reply('⚠️ Top-up request not found, please start again.');
    }

    await topupsDb.setTopupStatus(topup.id, 'verifying', { screenshot_file_id: fileId });
    state.clear(ctx.from.id);

    await ctx.reply(
      '✅ Screenshot received! Your top-up is being verified by our admin team. ' +
      'Your balance will be updated shortly.'
    );

    const { Markup } = require('telegraf');
    const { notifyAdminsWithPhoto } = require('../utils/superAdmin');
    await notifyAdminsWithPhoto(ctx.telegram, fileId, {
      caption:
        `💵 *Balance Top-Up Verification Needed*\n\n` +
        `Top-up #${topup.id}\n` +
        `User: ${ctx.from.username ? '@' + ctx.from.username : ctx.from.id}\n` +
        `Amount: ₹${Number(topup.amount).toFixed(2)}`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve', `admin:topup:approve:${topup.id}`),
          Markup.button.callback('❌ Reject', `admin:topup:reject:${topup.id}`)
        ]
      ])
    });
  });

  // ---- Daily Gift ----
  bot.action('menu:dailygift', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await users.getUser(ctx.from.id);
    const now = Date.now();
    const last = user.last_daily_gift ? new Date(user.last_daily_gift).getTime() : 0;

    if (now - last < DAILY_GIFT_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((DAILY_GIFT_COOLDOWN_MS - (now - last)) / (60 * 60 * 1000));
      return ctx.editMessageText(
        `🎁 You already claimed your daily gift. Try again in ~${hoursLeft}h.`,
        kb.mainMenu()
      );
    }

    const amount = (Math.random() * (DAILY_GIFT_MAX - DAILY_GIFT_MIN) + DAILY_GIFT_MIN).toFixed(2);
    await users.creditBalance(ctx.from.id, Number(amount), 'daily_gift', 'Daily spin gift');

    const pool = require('../db/pool');
    await pool.query('UPDATE users SET last_daily_gift = now() WHERE telegram_id = $1', [ctx.from.id]);

    await ctx.editMessageText(
      `🎁 You won 💰 ₹${amount}! It has been added to your balance.`,
      kb.mainMenu()
    );
  });
}

module.exports = { register };
