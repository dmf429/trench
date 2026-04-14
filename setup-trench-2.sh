#!/bin/bash
# TRENCH — Source Files Setup (Part 2)
echo "🪖 Writing source files..."

# ── backend/src/db/schema.sql ───────────────────────────
cat > backend/src/db/schema.sql << 'EOF'
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
EOF

echo "✓ Database schema created"

# ── backend/src/db/seed-kols.ts ─────────────────────────
cat > backend/src/db/seed-kols.ts << 'EOF'
import { Pool } from 'pg'
const db = new Pool({ connectionString: process.env.DATABASE_URL })

const KOL_WALLETS = [
  { address: 'ANSMhFpT8RFkXpZGvohFc8EBvn6MRmAHMPT14CiUxRwM', display_name: 'Ansem', twitter_handle: 'blknoiz06', is_verified: true },
  { address: 'GigaDegenWallet1111111111111111111111111111', display_name: 'GigaDegen', twitter_handle: 'GigaDegen', is_verified: true },
]

async function seed() {
  console.log(`Seeding ${KOL_WALLETS.length} KOL wallets...`)
  for (const kol of KOL_WALLETS) {
    await db.query(
      `INSERT INTO kol_wallets (address, display_name, twitter_handle, is_verified, reputation_score)
       VALUES ($1,$2,$3,$4,50) ON CONFLICT (address) DO UPDATE SET
       display_name=EXCLUDED.display_name, twitter_handle=EXCLUDED.twitter_handle`,
      [kol.address, kol.display_name, kol.twitter_handle, kol.is_verified]
    )
    console.log(`  ✓ ${kol.display_name}`)
  }
  await db.end()
  console.log('Done.')
}
seed().catch(err => { console.error(err); process.exit(1) })
EOF

echo "✓ Seed file created"

# ── backend/src/middleware/auth.ts ──────────────────────
cat > backend/src/middleware/auth.ts << 'EOF'
import { Request, Response, NextFunction } from 'express'
import { PublicKey } from '@solana/web3.js'

export interface AuthRequest extends Request {
  walletAddress?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const walletAddress = req.headers['x-wallet-address'] as string
  if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
    return res.status(401).json({ error: 'Valid wallet address required' })
  }
  req.walletAddress = walletAddress
  next()
}

export function softAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const walletAddress = req.headers['x-wallet-address'] as string
  if (walletAddress && isValidSolanaAddress(walletAddress)) {
    req.walletAddress = walletAddress
  }
  next()
}

function isValidSolanaAddress(address: string): boolean {
  try { new PublicKey(address); return true } catch { return false }
}
EOF

echo "✓ Auth middleware created"

# ── frontend/src/app/globals.css ────────────────────────
cat > frontend/src/app/globals.css << 'EOF'
:root {
  --bg: #050508;
  --surface: #0a0a10;
  --surface2: #0d0d18;
  --border: #1a1a2e;
  --border2: #1f1f3a;
  --green: #00ff88;
  --green-dim: rgba(0,255,136,0.15);
  --red: #ff3366;
  --red-dim: rgba(255,51,102,0.15);
  --gold: #ffd700;
  --blue: #0088ff;
  --dim: #3a3a5c;
  --text: #e0e0f0;
  --muted: #6666aa;
  --font-mono: 'Share Tech Mono', monospace;
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --sidebar-w: 240px;
  --topbar-h: 52px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  height: 100%;
  overflow: hidden;
}

body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.012) 2px, rgba(0,255,136,0.012) 4px);
  pointer-events: none;
  z-index: 9000;
}

.app-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.app-body { display: flex; flex: 1; overflow: hidden; }
.app-main { flex: 1; overflow-y: auto; background: var(--bg); }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

.mono { font-family: var(--font-mono); }
.display { font-family: var(--font-display); }
.muted { color: var(--muted); }
.green { color: var(--green); }
.red { color: var(--red); }

.btn {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  padding: 8px 20px;
}
.btn-primary { background: var(--green); color: var(--bg); clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%); }
.btn-primary:hover { background: #00ffaa; box-shadow: 0 0 20px rgba(0,255,136,0.3); }
.btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border2); }
.btn-ghost:hover { color: var(--text); border-color: var(--dim); }
.btn-danger { background: var(--red-dim); color: var(--red); border: 1px solid rgba(255,51,102,0.3); }

.card { background: var(--surface); border: 1px solid var(--border); }
.card-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 3px; color: var(--muted); text-transform: uppercase; }

input, textarea {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}
input::placeholder, textarea::placeholder { color: var(--dim); }
input:focus, textarea:focus { border-color: rgba(0,255,136,0.4); }

.badge { font-family: var(--font-mono); font-size: 8px; letter-spacing: 1px; text-transform: uppercase; padding: 2px 6px; display: inline-block; }
.badge-holding { background: rgba(0,255,136,0.1); color: var(--green); border: 1px solid rgba(0,255,136,0.2); }
.badge-sold { background: rgba(255,51,102,0.1); color: var(--red); border: 1px solid rgba(255,51,102,0.2); }
.badge-kol { background: rgba(255,215,0,0.1); color: var(--gold); border: 1px solid rgba(255,215,0,0.2); }
.badge-new { background: rgba(0,136,255,0.1); color: var(--blue); border: 1px solid rgba(0,136,255,0.2); }

.risk-safe { color: var(--green); }
.risk-caution { color: var(--gold); }
.risk-danger { color: #ff8800; }
.risk-rug { color: var(--red); }
.pnl-up { color: var(--green); }
.pnl-down { color: var(--red); }

@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
@keyframes slideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
@keyframes alertPulse { 0%,100% { box-shadow:0 0 0 0 rgba(255,51,102,0); } 50% { box-shadow:0 0 0 4px rgba(255,51,102,0.15); } }
EOF

echo "✓ Global CSS created"

# ── frontend/src/app/layout.tsx ─────────────────────────
cat > frontend/src/app/layout.tsx << 'EOF'
'use client'
import { useEffect } from 'react'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <title>TRENCH — The Trenches, Upgraded</title>
        <meta name="description" content="The crypto-native community platform for memecoin traders." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-shell">
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  )
}
EOF

echo "✓ Layout created"

# ── frontend/src/app/page.tsx ───────────────────────────
cat > frontend/src/app/page.tsx << 'EOF'
'use client'
import { useState } from 'react'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050508',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      }} />

      {/* Logo */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'clamp(80px, 15vw, 140px)',
        letterSpacing: '16px',
        color: '#00FF88',
        textShadow: '0 0 40px rgba(0,255,136,0.6), 0 0 80px rgba(0,255,136,0.3)',
        lineHeight: 1,
        position: 'relative',
        zIndex: 1,
        marginBottom: '8px',
      }}>
        TRENCH
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '12px',
        letterSpacing: '6px',
        color: 'rgba(0,255,136,0.5)',
        textTransform: 'uppercase',
        marginBottom: '40px',
        position: 'relative',
        zIndex: 1,
      }}>
        The Trenches, Upgraded
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '13px',
        color: '#6666aa',
        textAlign: 'center',
        maxWidth: '480px',
        lineHeight: 1.8,
        marginBottom: '48px',
        position: 'relative',
        zIndex: 1,
        letterSpacing: '1px',
      }}>
        One platform. Every coin. Real-time KOL tracking.<br />
        25% sell alerts. On-chain truth. Built for degens.
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '40px',
        marginBottom: '48px',
        position: 'relative',
        zIndex: 1,
      }}>
        {[
          { val: '24,891', label: 'Active Rooms' },
          { val: '340+', label: 'KOLs Tracked' },
          { val: '<3s', label: 'Alert Speed' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', color: '#00FF88', letterSpacing: '2px', textShadow: '0 0 16px rgba(0,255,136,0.4)' }}>{s.val}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: '#3a3a5c', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Waitlist */}
      <div style={{ display: 'flex', gap: 0, maxWidth: '420px', width: '100%', position: 'relative', zIndex: 1 }}>
        <input
          type="text"
          placeholder="Wallet address or email..."
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            flex: 1,
            background: '#0a0a10',
            border: '1px solid #1a1a2e',
            borderRight: 'none',
            color: '#e0e0f0',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '12px',
            padding: '14px 18px',
            outline: 'none',
            letterSpacing: '1px',
          }}
        />
        <button
          onClick={() => { if (email.trim()) setJoined(true) }}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#050508',
            background: joined ? '#00ffaa' : '#00FF88',
            border: 'none',
            padding: '14px 24px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          {joined ? '✓ YOU\'RE IN' : 'JOIN WAITLIST'}
        </button>
      </div>

      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '9px',
        color: '#3a3a5c',
        letterSpacing: '2px',
        marginTop: '12px',
        position: 'relative',
        zIndex: 1,
      }}>
        // 847 SPOTS REMAINING · NO SPAM · EVER
      </div>

      {/* Bottom ticker */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: '32px',
        background: 'rgba(10,10,16,0.9)',
        borderTop: '1px solid #1a1a2e',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          gap: '48px',
          animation: 'ticker 25s linear infinite',
          whiteSpace: 'nowrap',
          padding: '0 24px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '10px',
        }}>
          {['$WIF ▲ +67% · 8 KOLs', '$BONK ▼ -12% · 3 exited', '$POPCAT ▲ +431% · 19 KOLs', '⚠ KOL sold 47% · 3s ago', '$MOODENG ▲ +189% · 14 KOLs', '$GOAT ▼ -34% · 7 exited', '$FWOG ▲ +92% · 11 KOLs'].map((t, i) => (
            <span key={i} style={{ color: t.includes('▲') ? '#00FF88' : t.includes('▼') ? '#ff3366' : t.includes('⚠') ? '#ffd700' : '#6666aa', flexShrink: 0 }}>{t}</span>
          ))}
        </div>
        <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </div>
    </div>
  )
}
EOF

echo "✓ Home page created"

# ── frontend/src/lib/api.ts ─────────────────────────────
cat > frontend/src/lib/api.ts << 'EOF'
const DEXSCREENER_BASE = 'https://api.dexscreener.com'

export const dexscreener = {
  async getToken(address: string) {
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${address}`)
      const data = await res.json()
      return data.pairs?.[0] ?? null
    } catch { return null }
  },
  async getTokens(addresses: string[]) {
    if (!addresses.length) return []
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${addresses.slice(0,30).join(',')}`)
      const data = await res.json()
      return data.pairs ?? []
    } catch { return [] }
  },
}

export const solana = {
  isValidAddress(address: string): boolean {
    try {
      if (address.length < 32 || address.length > 44) return false
      return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
    } catch { return false }
  },
  truncate(address: string): string {
    return `${address.slice(0,4)}...${address.slice(-4)}`
  },
}

export const api = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  async get(path: string) {
    const res = await fetch(`${this.baseUrl}${path}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  },
  async post(path: string, body: any) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  },
}
EOF

echo "✓ API lib created"

# ── frontend/src/hooks/useSocket.ts ─────────────────────
cat > frontend/src/hooks/useSocket.ts << 'EOF'
'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useAlertStore } from '../store/alerts'
import { useRoomStore } from '../store/rooms'
import type { WSEvent, ChatMessage, SellAlert, BuyAlert, WhaleMove } from '../types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'

interface UseSocketOptions {
  walletAddress: string | null
  onSellAlert?: (alert: SellAlert) => void
  onBuyAlert?: (alert: BuyAlert) => void
  onWhaleMove?: (move: WhaleMove) => void
}

export function useSocket({ walletAddress, onSellAlert, onBuyAlert, onWhaleMove }: UseSocketOptions) {
  const socketRef = useRef<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const addAlert = useAlertStore(s => s.addAlert)
  const updateRoomPrice = useRoomStore(s => s.updatePrice)
  const updateRoomHealth = useRoomStore(s => s.updateHealth)
  const addMessage = useRoomStore(s => s.addMessage)
  const addRoom = useRoomStore(s => s.addRoom)

  useEffect(() => {
    if (!walletAddress || typeof window === 'undefined') return
    let socket: any

    const connect = async () => {
      const { io } = await import('socket.io-client')
      socket = io(WS_URL, {
        auth: { walletAddress },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
      })
      socketRef.current = socket

      socket.on('connect', () => setIsConnected(true))
      socket.on('disconnect', () => setIsConnected(false))

      socket.on('ws:event', (event: WSEvent) => {
        switch (event.type) {
          case 'alert:sell':
            addAlert(event.payload)
            onSellAlert?.(event.payload)
            if (event.payload.isUnusual && Notification.permission === 'granted') {
              new Notification(`⚠️ ${event.payload.kolWallet.displayName} sold ${event.payload.percentSold}%`, {
                body: `${event.payload.token.symbol} — $${event.payload.amountUsd.toFixed(0)}`,
              })
            }
            break
          case 'alert:buy': addAlert(event.payload); onBuyAlert?.(event.payload); break
          case 'whale:move': onWhaleMove?.(event.payload); break
          case 'room:price_update': updateRoomPrice(event.payload.roomId, event.payload.price, event.payload.change); break
          case 'room:health_update': updateRoomHealth(event.payload.roomId, event.payload.score); break
          case 'room:new': addRoom(event.payload); break
        }
      })

      socket.on('room:message', (msg: ChatMessage) => addMessage(msg.roomId, msg))
      socket.on('room:history', (msgs: ChatMessage[]) => msgs.forEach(m => addMessage(m.roomId, m)))
    }

    connect()
    return () => { socket?.disconnect(); socketRef.current = null }
  }, [walletAddress])

  const joinRoom = useCallback((roomId: string) => socketRef.current?.emit('room:join', roomId), [])
  const leaveRoom = useCallback((roomId: string) => socketRef.current?.emit('room:leave', roomId), [])
  const sendMessage = useCallback((roomId: string, content: string) => {
    if (!content.trim()) return
    socketRef.current?.emit('room:message', { roomId, content })
  }, [])
  const flagRoom = useCallback((roomId: string, reason: string) => socketRef.current?.emit('room:flag', { roomId, reason }), [])
  const subscribeToWallets = useCallback((addresses: string[]) => socketRef.current?.emit('tracker:subscribe', addresses), [])

  return { isConnected, joinRoom, leaveRoom, sendMessage, flagRoom, subscribeToWallets }
}
EOF

echo "✓ Socket hook created"

# ── frontend/src/hooks/useKOLTracker.ts ─────────────────
cat > frontend/src/hooks/useKOLTracker.ts << 'EOF'
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { KOLWallet } from '../types'

export function useKOLTracker(walletAddress: string | null) {
  const [kols, setKOLs] = useState<KOLWallet[]>([])
  const [trackedAddresses, setTracked] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadKOLs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/kols?limit=100')
      const data = await res.json()
      setKOLs(data.kols ?? [])
    } catch { }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { loadKOLs() }, [])

  const addWallet = useCallback(async (targetAddress: string, label?: string) => {
    if (!walletAddress) return false
    try {
      await fetch(`/api/wallets/${walletAddress}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAddress, label }),
      })
      setTracked(prev => [...prev, targetAddress])
      return true
    } catch { return false }
  }, [walletAddress])

  const removeWallet = useCallback(async (targetAddress: string) => {
    if (!walletAddress) return
    try {
      await fetch(`/api/wallets/${walletAddress}/track/${targetAddress}`, { method: 'DELETE' })
      setTracked(prev => prev.filter(a => a !== targetAddress))
    } catch { }
  }, [walletAddress])

  return {
    kols,
    trackedKOLs: kols.filter(k => trackedAddresses.includes(k.address)),
    trackedAddresses,
    isLoading,
    addWallet,
    removeWallet,
    refresh: loadKOLs,
  }
}
EOF

echo "✓ KOL tracker hook created"

echo ""
echo "✅ All source files written!"
echo ""
echo "Now run:"
echo "  git add ."
echo "  git commit -m 'feat: add all source files'"
echo "  git push origin main"
