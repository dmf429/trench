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
