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
