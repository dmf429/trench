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
