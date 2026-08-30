const { Markup } = require('telegraf');
    const buttons = plans.map((p) => [
      Markup.button.callback(${p.is_active ? '🟢' : '🔴'} ${p.name} — ₹${p.price}, admin:toggleplan:${p.id})
    ]);
    await ctx.reply('Tap a plan to toggle availability:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^admin:toggleplan:(\d+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const planId = Number(ctx.match[1]);
    const plan = await catalog.getPlan(planId);
    await catalog.setPlanActive(planId, !plan.is_active);
    await ctx.reply(${!plan.is_active ? '🟢 Enabled' : '🔴 Disabled'}: ${plan.name});
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
      return ctx.reply(✅ Category created: ${category.name} (id ${category.id}). It's active by default.);
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
      return ctx.reply(✅ Plan created: ${plan.name} — ₹${plan.price}. It's active by default.);
    }

    if (s.action === 'admin_setupi_text') {
      const upiId = ctx.message.text.trim();
      await settingsDb.updateSettings({ upi_id: upiId });
      state.clear(ctx.from.id);
      return ctx.reply(✅ UPI ID updated to: ${upiId});
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
