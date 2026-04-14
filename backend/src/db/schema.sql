CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE token_rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_address   VARCHAR(44) UNIQUE NOT NULL,
  token_name      VARCHAR(100) NOT NULL,
  token_symbol    VARCHAR(20) NOT NULL,
  token_logo_uri  TEXT,
  pumpfun_id      VARCHAR(100),
  market_cap      DECIMAL(20,4) DEFAULT 0,
  price           DECIMAL(30,12) DEFAULT 0,
  price_change_24h DECIMAL(10,4) DEFAULT 0,
  volume_24h      DECIMAL(20,4) DEFAULT 0,
  liquidity       DECIMAL(20,4) DEFAULT 0,
  health_score    INTEGER DEFAULT 50,
  flag_count      INTEGER DEFAULT 0,
  member_count    INTEGER DEFAULT 0,
  message_count   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_activity   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address        VARCHAR(44) UNIQUE NOT NULL,
  display_name          VARCHAR(50),
  avatar_url            TEXT,
  reputation_score      INTEGER DEFAULT 0,
  is_verified_caller    BOOLEAN DEFAULT FALSE,
  badge_type            VARCHAR(20),
  total_pnl             DECIMAL(20,4) DEFAULT 0,
  win_rate              DECIMAL(5,2) DEFAULT 0,
  total_trades          INTEGER DEFAULT 0,
  joined_at             TIMESTAMPTZ DEFAULT NOW(),
  last_seen             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kol_wallets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address             VARCHAR(44) UNIQUE NOT NULL,
  display_name        VARCHAR(100) NOT NULL,
  twitter_handle      VARCHAR(50),
  avatar_url          TEXT,
  is_verified         BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  reputation_score    INTEGER DEFAULT 50,
  manipulation_score  INTEGER DEFAULT 0,
  pnl_24h             DECIMAL(20,4) DEFAULT 0,
  pnl_7d              DECIMAL(20,4) DEFAULT 0,
  pnl_30d             DECIMAL(20,4) DEFAULT 0,
  pnl_all_time        DECIMAL(20,4) DEFAULT 0,
  win_rate            DECIMAL(5,2) DEFAULT 0,
  total_trades        INTEGER DEFAULT 0,
  avg_hold_time       INTEGER DEFAULT 0,
  added_at            TIMESTAMPTZ DEFAULT NOW(),
  last_synced         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kol_positions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kol_id            UUID REFERENCES kol_wallets(id) ON DELETE CASCADE,
  token_address     VARCHAR(44) NOT NULL,
  token_symbol      VARCHAR(20) NOT NULL,
  token_name        VARCHAR(100) NOT NULL,
  entry_price       DECIMAL(30,12) NOT NULL,
  current_price     DECIMAL(30,12) DEFAULT 0,
  amount_tokens     DECIMAL(30,6) NOT NULL,
  amount_sol        DECIMAL(20,6) NOT NULL,
  value_usd         DECIMAL(20,4) DEFAULT 0,
  pnl_usd           DECIMAL(20,4) DEFAULT 0,
  pnl_percent       DECIMAL(10,4) DEFAULT 0,
  status            VARCHAR(10) DEFAULT 'holding',
  percent_sold      DECIMAL(5,2) DEFAULT 0,
  entered_at        TIMESTAMPTZ NOT NULL,
  last_activity     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kol_id, token_address)
);

CREATE TABLE alerts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type        VARCHAR(20) NOT NULL,
  kol_id            UUID REFERENCES kol_wallets(id),
  token_address     VARCHAR(44) NOT NULL,
  token_symbol      VARCHAR(20) NOT NULL,
  percent_sold      DECIMAL(5,2),
  amount_sol        DECIMAL(20,6),
  amount_usd        DECIMAL(20,4),
  remaining_position DECIMAL(5,2),
  is_unusual        BOOLEAN DEFAULT FALSE,
  severity          VARCHAR(10) DEFAULT 'medium',
  tx_signature      VARCHAR(100),
  detected_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whale_moves (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address  VARCHAR(44) NOT NULL,
  wallet_label    VARCHAR(100),
  token_address   VARCHAR(44) NOT NULL,
  token_symbol    VARCHAR(20) NOT NULL,
  move_type       VARCHAR(10) NOT NULL,
  amount_sol      DECIMAL(20,6) NOT NULL,
  amount_usd      DECIMAL(20,4) NOT NULL,
  is_known_wallet BOOLEAN DEFAULT FALSE,
  tx_signature    VARCHAR(100),
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID REFERENCES token_rooms(id) ON DELETE CASCADE,
  sender_address  VARCHAR(44) NOT NULL,
  content         TEXT NOT NULL,
  message_type    VARCHAR(10) DEFAULT 'message',
  reactions       JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_tracked_wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address  VARCHAR(44) NOT NULL,
  label           VARCHAR(100),
  is_kol          BOOLEAN DEFAULT FALSE,
  kol_id          UUID REFERENCES kol_wallets(id),
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wallet_address)
);

CREATE TABLE health_scores (
  room_id                 UUID PRIMARY KEY REFERENCES token_rooms(id),
  total                   INTEGER DEFAULT 50,
  kol_conviction          INTEGER DEFAULT 0,
  liquidity_depth         INTEGER DEFAULT 0,
  wallet_concentration    INTEGER DEFAULT 0,
  volume_authenticity     INTEGER DEFAULT 0,
  flags                   TEXT[] DEFAULT '{}',
  risk_level              VARCHAR(10) DEFAULT 'caution',
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kol_room_sentiment (
  room_id           UUID REFERENCES token_rooms(id),
  kol_id            UUID REFERENCES kol_wallets(id),
  is_holding        BOOLEAN DEFAULT TRUE,
  entry_price       DECIMAL(30,12),
  bag_value_sol     DECIMAL(20,6),
  bag_value_usd     DECIMAL(20,4),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, kol_id)
);

CREATE INDEX idx_rooms_active ON token_rooms(is_active, last_activity DESC);
CREATE INDEX idx_rooms_token ON token_rooms(token_address);
CREATE INDEX idx_alerts_unusual ON alerts(is_unusual, detected_at DESC);
CREATE INDEX idx_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_kol_address ON kol_wallets(address);
CREATE INDEX idx_users_wallet ON users(wallet_address);
