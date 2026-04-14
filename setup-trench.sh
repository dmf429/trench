#!/bin/bash
# TRENCH — Full Project Setup Script
# Run from ~/Desktop/trench directory

echo "🪖 Setting up TRENCH project..."

# ── Directory Structure ──────────────────────────────────
mkdir -p frontend/src/app/room/\[id\]
mkdir -p frontend/src/components/{rooms,tracker,feed,alerts,ui}
mkdir -p frontend/src/{hooks,lib,store,types}
mkdir -p backend/src/{routes,services,middleware,socket,db}
mkdir -p shared

echo "✓ Directories created"

# ── backend/.env.example ────────────────────────────────
cat > backend/.env.example << 'EOF'
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/trench
REDIS_URL=redis://localhost:6379
HELIUS_API_KEY=YOUR_HELIUS_API_KEY
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
HELIUS_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
DEXSCREENER_BASE_URL=https://api.dexscreener.com
EOF

# ── frontend/.env.example ───────────────────────────────
cat > frontend/.env.example << 'EOF'
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_PRIVY_APP_ID
NEXT_PUBLIC_API_URL=http://localhost:4000/api
EOF

# ── backend/package.json ────────────────────────────────
cat > backend/package.json << 'EOF'
{
  "name": "trench-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "psql $DATABASE_URL < src/db/schema.sql"
  },
  "dependencies": {
    "@solana/web3.js": "^1.91.0",
    "cors": "^2.8.5",
    "express": "^4.18.3",
    "ioredis": "^5.3.2",
    "pg": "^8.11.3",
    "socket.io": "^4.7.4"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.5",
    "@types/pg": "^8.11.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
EOF

# ── frontend/package.json ───────────────────────────────
cat > frontend/package.json << 'EOF'
{
  "name": "trench-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@privy-io/react-auth": "^1.65.0",
    "@solana/web3.js": "^1.91.0",
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.4",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "typescript": "^5.3.3"
  }
}
EOF

# ── backend/tsconfig.json ───────────────────────────────
cat > backend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# ── docker-compose.yml ──────────────────────────────────
cat > docker-compose.yml << 'EOF'
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    container_name: trench-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: trench
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/src/db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
  redis:
    image: redis:7-alpine
    container_name: trench-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --save 60 1 --loglevel warning
volumes:
  postgres_data:
  redis_data:
EOF

# ── .gitignore ──────────────────────────────────────────
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
.env.local
.next/
*.log
.DS_Store
EOF

# ── README.md ───────────────────────────────────────────
cat > README.md << 'EOF'
# TRENCH 🪖
### The Social Layer for Memecoin Traders

> One platform. Every coin. Real-time intel. On-chain truth.

## Quick Start
```bash
# Start DB + Redis
docker-compose up -d

# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Stack
- Next.js 14 + TypeScript
- Node.js + Express + Socket.io
- PostgreSQL + Redis
- Solana Web3.js + Helius RPC
- Privy wallet auth
EOF

echo "✓ Config files created"

# ── frontend/src/types/index.ts ─────────────────────────
cat > frontend/src/types/index.ts << 'EOF'
export interface Token {
  address: string
  name: string
  symbol: string
  logoUri?: string
  decimals: number
  createdAt: Date
}

export interface KOLSentiment {
  total: number
  holding: number
  sold: number
  holdingPercent: number
  avgEntryPrice: number
  avgBagValueUsd: number
  avgBagValueSol: number
}

export interface TokenRoom {
  id: string
  token: Token
  marketCap: number
  price: number
  priceChange24h: number
  volume24h: number
  liquidity: number
  healthScore: number
  kolSentiment: KOLSentiment
  memberCount: number
  messageCount: number
  flagCount: number
  isActive: boolean
  createdAt: Date
}

export interface KOLWallet {
  id: string
  address: string
  displayName: string
  twitterHandle?: string
  avatar?: string
  isVerified: boolean
  reputationScore: number
  manipulationScore: number
  stats: KOLStats
  currentPositions: Position[]
  addedAt: Date
}

export interface KOLStats {
  pnl24h: number
  pnl7d: number
  pnl30d: number
  pnlAllTime: number
  winRate: number
  avgHoldTime: number
  totalTrades: number
  bestTrade: number
  worstTrade: number
  isStillHolding?: boolean
}

export interface Position {
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  entryPrice: number
  currentPrice: number
  amountTokens: number
  amountSol: number
  valueUsd: number
  pnlUsd: number
  pnlPercent: number
  enteredAt: Date
  lastActivity: Date
  status: 'holding' | 'sold' | 'partial'
  percentSold?: number
}

export interface SellAlert {
  id: string
  kolWallet: KOLWallet
  token: Token
  percentSold: number
  amountSol: number
  amountUsd: number
  remainingPosition: number
  detectedAt: Date
  isUnusual: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface BuyAlert {
  id: string
  kolWallet: KOLWallet
  token: Token
  amountSol: number
  amountUsd: number
  detectedAt: Date
  isNewPosition: boolean
}

export interface WhaleMove {
  id: string
  walletAddress: string
  walletLabel?: string
  token: Token
  amountSol: number
  amountUsd: number
  type: 'buy' | 'sell'
  detectedAt: Date
  isKnownWallet: boolean
}

export interface ChatMessage {
  id: string
  roomId: string
  sender: {
    walletAddress: string
    displayName: string
    reputationScore: number
    isVerified: boolean
    badgeType?: 'top-caller' | 'whale' | 'kol' | 'rugged'
  }
  content: string
  type: 'message' | 'flag' | 'system'
  timestamp: Date
  reactions?: Record<string, number>
}

export interface HealthScore {
  total: number
  breakdown: {
    kolConviction: number
    liquidityDepth: number
    walletConcentration: number
    volumeAuthenticity: number
  }
  flags: string[]
  riskLevel: 'safe' | 'caution' | 'danger' | 'rug'
  updatedAt: Date
}

export interface UserProfile {
  walletAddress: string
  displayName: string
  avatar?: string
  joinedAt: Date
  reputationScore: number
  stats: {
    totalPnl: number
    winRate: number
    bestCall: number
    totalTrades: number
  }
  trackedWallets: string[]
  activeRooms: string[]
  isVerifiedCaller: boolean
}

export type WSEvent =
  | { type: 'room:message'; payload: ChatMessage }
  | { type: 'room:flag'; payload: { roomId: string; count: number } }
  | { type: 'alert:sell'; payload: SellAlert }
  | { type: 'alert:buy'; payload: BuyAlert }
  | { type: 'whale:move'; payload: WhaleMove }
  | { type: 'room:price_update'; payload: { roomId: string; price: number; change: number } }
  | { type: 'room:health_update'; payload: { roomId: string; score: HealthScore } }
  | { type: 'room:new'; payload: TokenRoom }
EOF

echo "✓ Types created"

# ── frontend/src/store/alerts.ts ────────────────────────
cat > frontend/src/store/alerts.ts << 'EOF'
import { create } from 'zustand'
import type { SellAlert, BuyAlert } from '../types'

type Alert = SellAlert | BuyAlert

interface AlertStore {
  alerts: Alert[]
  unreadCount: number
  addAlert: (alert: Alert) => void
  markAllRead: () => void
  clearAlerts: () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set(s => ({
      alerts: [alert, ...s.alerts].slice(0, 100),
      unreadCount: s.unreadCount + 1,
    })),
  markAllRead: () => set({ unreadCount: 0 }),
  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
}))
EOF

# ── frontend/src/store/rooms.ts ─────────────────────────
cat > frontend/src/store/rooms.ts << 'EOF'
import { create } from 'zustand'
import type { TokenRoom, ChatMessage, HealthScore } from '../types'

interface RoomStore {
  rooms: TokenRoom[]
  messages: Record<string, ChatMessage[]>
  setRooms: (rooms: TokenRoom[]) => void
  addRoom: (room: TokenRoom) => void
  updatePrice: (roomId: string, price: number, change: number) => void
  updateHealth: (roomId: string, score: HealthScore) => void
  addMessage: (roomId: string, msg: ChatMessage) => void
  incrementFlag: (roomId: string) => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  rooms: [],
  messages: {},
  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) =>
    set(s => ({
      rooms: s.rooms.some(r => r.id === room.id) ? s.rooms : [room, ...s.rooms],
    })),
  updatePrice: (roomId, price, change) =>
    set(s => ({
      rooms: s.rooms.map(r => r.id === roomId ? { ...r, price, priceChange24h: change } : r),
    })),
  updateHealth: (roomId, score) =>
    set(s => ({
      rooms: s.rooms.map(r => r.id === roomId ? { ...r, healthScore: score.total } : r),
    })),
  addMessage: (roomId, msg) =>
    set(s => {
      const existing = s.messages[roomId] ?? []
      const updated = [...existing, msg].slice(-200)
      return { messages: { ...s.messages, [roomId]: updated } }
    }),
  incrementFlag: (roomId) =>
    set(s => ({
      rooms: s.rooms.map(r => r.id === roomId ? { ...r, flagCount: r.flagCount + 1 } : r),
    })),
}))
EOF

echo "✓ Stores created"
echo ""
echo "✅ TRENCH project scaffold complete!"
echo ""
echo "Next steps:"
echo "  1. cd ~/Desktop/trench"
echo "  2. git add ."
echo "  3. git commit -m 'initial commit — full TRENCH scaffold'"
echo "  4. git push origin main"
