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
