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
