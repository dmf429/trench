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
