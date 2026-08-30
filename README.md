# NexsusMod Store — Telegram Bot

A Telegram storefront bot: category → plan → UPI payment → screenshot verification →
admin approval → wallet credit → key/account delivery. Built generic so the admin
can add **any** digital product without touching code.

**Stack:** Node.js + Telegraf · Neon (Postgres) · Railway (hosting)

---

## You do NOT need to install npm, run migrations, or touch a terminal.

Railway does all of that automatically on every deploy:
- Installs dependencies
- Creates/updates every database table (the bot does this itself on every boot)
- Starts the bot

**Your only job: create two accounts, get 4 values, paste them into Railway as
environment variables. That's it.**

---

## Step 1 — Create your bot on Telegram

1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, follow the prompts, pick a name and a username ending in `bot`
   (e.g. `NexsusModStoreBot`).
3. BotFather replies with a **token** — looks like `123456789:AAExampleTokenGoesHere`.
   Copy it. This is your `BOT_TOKEN`.
4. Message **@userinfobot** — it replies with your numeric Telegram ID. Copy it.
   This is your `SUPER_ADMIN_ID` and also your `ADMIN_CHAT_ID` (you can use the same
   number for both — orders/screenshots will land in your DM with the bot).

## Step 2 — Create your database on Neon

1. Go to https://neon.tech → sign up → **Create a project**.
2. On the project dashboard, copy the **connection string** shown — looks like:
   `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`
   This is your `DATABASE_URL`. Copy it as-is.

## Step 3 — Push this project to GitHub

1. Create a new (private, recommended) repo on GitHub.
2. Upload everything in this folder to it — either drag-and-drop on GitHub's web UI,
   or `git push` if you're comfortable with git. Either way, no npm needed for this step.

## Step 4 — Deploy on Railway

1. Go to https://railway.com → **New Project → Deploy from GitHub repo** → pick your repo.
2. Railway will detect it's a Node project automatically (via `railway.json`).
3. Go to the **Variables** tab of your Railway service and add these 4:

   | Variable | Value |
   |---|---|
   | `BOT_TOKEN` | from Step 1 |
   | `DATABASE_URL` | from Step 2 |
   | `SUPER_ADMIN_ID` | your Telegram ID from Step 1 |
   | `ADMIN_CHAT_ID` | same as `SUPER_ADMIN_ID` (or a group chat ID — see note below) |

4. Railway redeploys automatically whenever you save variables or push new code.
   Check the **Deployments → Logs** tab — once you see:
   ```
   🔧 Ensuring database schema is up to date...
   ✅ Database schema ready.
   ✅ NexsusMod Store bot is running.
   ```
   your bot is live. Open it in Telegram and send `/start`.

That's the entire setup. No terminal, no npm, no manual migration step — every time
Railway boots the bot, it re-checks the database schema itself and creates whatever's
missing.

> **Optional — using a group instead of your own DM for order notifications:**
> Create a private Telegram group, add your bot to it, send any message in the
> group, then visit `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` in your
> browser to find the group's chat ID (a negative number). Use that as
> `ADMIN_CHAT_ID` instead. Not required — your own ID works fine to start.

---

## How to use it — Admin guide

Send `/admin` to your bot from the `SUPER_ADMIN_ID` account to open the admin panel.

### Add a category (a product line, e.g. "Netflix")
`/admin` → **➕ Add Category** → type the name. Active (green) by default.

### Add a plan/sub-category (e.g. "1 Week" / "1 Month" with a price)
`/admin` → **➕ Add Plan (Sub-category)** → pick the category → type plan name
(e.g. `1 Week`) → type duration label (e.g. `7 days`, or `-` to skip) → type price
(e.g. `49`).

### Toggle availability (green = available, red = unavailable)
`/admin` → **🟢🔴 Toggle Availability** → toggle a whole category, or drill into
**View plans to toggle instead** for individual plans.

### Set your UPI QR code
`/admin` → **🖼 Set QR / UPI ID** → send the QR image → then send your UPI ID as text.
This is what customers see when they choose to pay.

### Handle an incoming order
1. Customer buys a plan, pays, sends a screenshot.
2. You get the screenshot with **✅ Approve / ❌ Reject** buttons.
3. Tap **Approve** → customer's wallet is credited & debited for the purchase (so
   it shows correctly in their history), and they automatically get: *"Payment
   verified! Generating your key, please wait..."* You get a follow-up asking you
   to deliver.
4. Deliver the product:
   ```
   /deliver <orderId> <the actual key or account details>
   ```
   Example:
   ```
   /deliver 42 Email: user@example.com | Password: abc123 | Valid till: 12 Sep
   ```
   The customer instantly receives this in their chat with the bot.
5. Tap **Reject** instead if the screenshot doesn't check out — customer is notified
   automatically.

### Check what's pending
- `/admin` → **📦 Pending Orders** — payments waiting on your approve/reject.
- `/admin` → **🔑 Pending Key Deliveries** — approved orders still waiting on
  `/deliver`.

### Add another admin (helper account)
Neon has a built-in SQL editor on your project dashboard — no terminal needed:
```sql
INSERT INTO admins (telegram_id) VALUES (987654321);
```

---

## How it looks to a customer

1. `/start` → sees balance + main menu.
2. **🛒 Buy Now** → categories (only ones marked available show up).
3. Tap a category → plans with prices.
4. Tap a plan → order summary (balance vs price, deficit if short).
5. **💰 PAY UPI** → QR code + exact amount.
6. Pays in their UPI app → taps **✅ VERIFY PAYMENT** → sends a screenshot.
7. Bot replies: *"Screenshot received! Being verified by admin..."*
8. You approve → *"Payment verified! Generating your key, please wait..."*
9. You run `/deliver` → they instantly get the account/key in chat.

Other menu buttons: **My Profile + All History** (balance, tier, recent orders),
**Refer And Earn** (personal link, ₹10 bonus to referrer by default), **Daily Gift**
(random ₹1–₹15 once per 24h), **Support** (shows your configured contact).

---

## Customizing later (all just text edits in the code, redeploy via GitHub push)

| What | File |
|---|---|
| Store name / start-menu text | `src/handlers/user.js` — `STORE_NAME` and the `/start` text |
| Referral bonus amount | `src/db/users.js` — `REFERRAL_BONUS` |
| Daily gift ₹ range | `src/handlers/user.js` — `DAILY_GIFT_MIN` / `DAILY_GIFT_MAX` |
| Add more payment methods | `src/utils/keyboards.js` (`confirmPayment`) + a new handler in `src/handlers/user.js` |

Any push to your GitHub repo auto-redeploys on Railway — still no manual steps.
