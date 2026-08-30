const { Markup } = require('telegraf');

function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🛒 Buy Now', 'menu:buy')],
    [
      Markup.button.callback('📥 Check Update', 'menu:update'),
      Markup.button.callback('💵 Add Balance', 'menu:addbalance')
    ],
    [Markup.button.callback('👑 My Profile + All History', 'menu:profile')],
    [
      Markup.button.callback('🔗 Refer And Earn', 'menu:refer'),
      Markup.button.callback('❗ How To Use Bot', 'menu:howto')
    ],
    [
      Markup.button.callback('📩 Support', 'menu:support'),
      Markup.button.callback('🎁 Daily Gift', 'menu:dailygift')
    ]
  ]);
}

function categoryList(categories) {
  const rows = categories.map((c) => [
    Markup.button.callback(`${c.emoji || '📦'} ${c.name}`, `cat:${c.id}`)
  ]);
  rows.push([Markup.button.callback('⬅️ Back', 'menu:main')]);
  return Markup.inlineKeyboard(rows);
}

function planList(plans, categoryId) {
  const rows = plans.map((p) => [
    Markup.button.callback(`${p.name} — ₹${p.price}`, `plan:${p.id}`)
  ]);
  rows.push([Markup.button.callback('⬅️ Back to Categories', 'menu:buy')]);
  return Markup.inlineKeyboard(rows);
}

function confirmPayment(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 PAY UPI', `pay:upi:${orderId}`)],
    [Markup.button.callback('➡️ Back to Plans', 'menu:buy')]
  ]);
}

function verifyOrCancel(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ VERIFY PAYMENT', `verify:${orderId}`)],
    [Markup.button.callback('➡️ Cancel Order', `cancel:${orderId}`)]
  ]);
}

function adminApproveReject(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `admin:approve:${orderId}`),
      Markup.button.callback('❌ Reject', `admin:reject:${orderId}`)
    ]
  ]);
}

function adminPanelMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Category', 'admin:addcat')],
    [Markup.button.callback('➕ Add Plan (Sub-category)', 'admin:addplan')],
    [Markup.button.callback('🟢🔴 Toggle Availability', 'admin:toggle')],
    [Markup.button.callback('🖼 Set QR / UPI ID', 'admin:setqr')],
    [Markup.button.callback('📦 Pending Orders', 'admin:pending')],
    [Markup.button.callback('🔑 Pending Key Deliveries', 'admin:pendingkeys')]
  ]);
}

module.exports = {
  mainMenu,
  categoryList,
  planList,
  confirmPayment,
  verifyOrCancel,
  adminApproveReject,
  adminPanelMenu
};
