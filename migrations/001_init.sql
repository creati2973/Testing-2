-- NexsusMod Store — Initial schema
-- Run against your Neon (Postgres) database.

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     BIGINT UNIQUE NOT NULL,
    username        TEXT,
    first_name      TEXT,
    balance         NUMERIC(10,2) NOT NULL DEFAULT 0,
    tier            TEXT NOT NULL DEFAULT 'CUSTOMER', -- CUSTOMER, RESELLER, ADMIN
    referral_code   TEXT UNIQUE,
    referred_by     BIGINT REFERENCES users(telegram_id),
    last_daily_gift TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    emoji       TEXT DEFAULT '📦',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
    id              BIGSERIAL PRIMARY KEY,
    category_id     BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,       -- e.g. "1 Week"
    duration_label  TEXT,                -- e.g. "7 days"
    price           NUMERIC(10,2) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(telegram_id),
    plan_id             BIGINT NOT NULL REFERENCES plans(id),
    category_name       TEXT NOT NULL,   -- snapshot at time of order
    plan_name           TEXT NOT NULL,   -- snapshot at time of order
    amount              NUMERIC(10,2) NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
        -- pending -> awaiting_screenshot -> verifying -> approved -> fulfilled
        --                                             -> rejected
    payment_method      TEXT DEFAULT 'UPI',
    screenshot_file_id  TEXT,
    admin_note          TEXT,
    delivered_content   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(telegram_id),
    amount      NUMERIC(10,2) NOT NULL,   -- positive = credit, negative = debit
    type        TEXT NOT NULL,            -- topup, purchase, refund, referral, daily_gift, admin_adjust
    order_id    BIGINT REFERENCES orders(id),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
    id              BIGSERIAL PRIMARY KEY,
    upi_id          TEXT,
    qr_file_id      TEXT,
    support_contact TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
    telegram_id BIGINT PRIMARY KEY,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_category ON plans(category_id);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id);

-- Seed one admin_settings row so the app can always UPDATE it
INSERT INTO admin_settings (upi_id, qr_file_id, support_contact)
SELECT 'yourupi@bank', NULL, '@NexsusModSupport'
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);
