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
