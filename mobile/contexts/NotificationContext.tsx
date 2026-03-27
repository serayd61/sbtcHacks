import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as Notifications from 'expo-notifications'
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { notificationService, PriceAlert } from '../services/NotificationService'

const BACKGROUND_FETCH_TASK = 'background-price-check'

interface NotificationContextType {
  isReady: boolean
  pushToken: string | null
  priceAlerts: PriceAlert[]
  createPriceAlert: (symbol: string, condition: 'above' | 'below', targetPrice: number) => Promise<void>
  deletePriceAlert: (alertId: string) => Promise<void>
  updatePriceAlert: (alertId: string, updates: Partial<PriceAlert>) => Promise<void>
  scheduleVaultNotification: (type: string, data: any) => Promise<void>
  scheduleOptionExpiryNotification: (optionData: any) => Promise<void>
  requestPermissions: () => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Background task for checking price alerts
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('Background fetch: Checking price alerts...')
    
    // Fetch current prices (mock data in this example)
    const prices = await fetchCurrentPrices()
    
    // Check price alerts
    await notificationService.checkPriceAlerts(prices)
    
    // Store last background fetch time
    await AsyncStorage.setItem('last_background_fetch', Date.now().toString())
    
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch (error) {
    console.error('Background fetch failed:', error)
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

async function fetchCurrentPrices(): Promise<Record<string, number>> {
  try {
    // In a real app, you'd fetch from your API or a price feed
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    const data = await response.json()
    
    return {
      BTC: data.bitcoin?.usd || 0,
      SBTC: data.bitcoin?.usd || 0, // sBTC follows BTC price
    }
  } catch (error) {
    console.error('Failed to fetch prices:', error)
    // Return mock data if fetch fails
    return {
      BTC: 95000 + (Math.random() - 0.5) * 2000,
      SBTC: 95000 + (Math.random() - 0.5) * 2000,
    }
  }
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const [pushToken, setPushToken] = useState<string | null>(null)
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])

  useEffect(() => {
    initializeNotifications()
    setupBackgroundFetch()
  }, [])

  const initializeNotifications = async () => {
    try {
      await notificationService.initialize()
      
      setIsReady(notificationService.isReady())
      setPushToken(notificationService.getPushToken())
      
      // Load existing price alerts
      const alerts = await notificationService.getPriceAlerts()
      setPriceAlerts(alerts)
      
      // Start price monitoring
      startPriceMonitoring()
    } catch (error) {
      console.error('Failed to initialize notifications:', error)
    }
  }

  const setupBackgroundFetch = async () => {
    try {
      // Register background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      })
      
      console.log('Background fetch registered successfully')
    } catch (error) {
      console.error('Failed to register background fetch:', error)
    }
  }

  const startPriceMonitoring = () => {
    // Check prices every 5 minutes when app is active
    const interval = setInterval(async () => {
      if (priceAlerts.length > 0) {
        const prices = await fetchCurrentPrices()
        await notificationService.checkPriceAlerts(prices)
        
        // Reload price alerts in case any were disabled
        const updatedAlerts = await notificationService.getPriceAlerts()
        setPriceAlerts(updatedAlerts)
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }

  const createPriceAlert = async (
    symbol: string, 
    condition: 'above' | 'below', 
    targetPrice: number
  ): Promise<void> => {
    try {
      const alert = await notificationService.createPriceAlert(symbol, condition, targetPrice)
      setPriceAlerts(prev => [...prev, alert])
      
      // Show confirmation notification
      await notificationService.scheduleLocalNotification(
        'Price Alert Created',
        `You'll be notified when ${symbol} goes ${condition} $${targetPrice}`,
        { seconds: 1 },
        { type: 'alert_created' }
      )
    } catch (error) {
      console.error('Failed to create price alert:', error)
      throw error
    }
  }

  const deletePriceAlert = async (alertId: string): Promise<void> => {
    try {
      await notificationService.deletePriceAlert(alertId)
      setPriceAlerts(prev => prev.filter(alert => alert.id !== alertId))
    } catch (error) {
      console.error('Failed to delete price alert:', error)
      throw error
    }
  }

  const updatePriceAlert = async (
    alertId: string, 
    updates: Partial<PriceAlert>
  ): Promise<void> => {
    try {
      await notificationService.updatePriceAlert(alertId, updates)
      setPriceAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId ? { ...alert, ...updates } : alert
        )
      )
    } catch (error) {
      console.error('Failed to update price alert:', error)
      throw error
    }
  }

  const scheduleVaultNotification = async (type: string, data: any): Promise<void> => {
    try {
      await notificationService.notifyVaultUpdate(
        type as 'deposit' | 'withdrawal' | 'epoch_start' | 'epoch_end',
        data.amount,
        data.epoch
      )
    } catch (error) {
      console.error('Failed to schedule vault notification:', error)
      throw error
    }
  }

  const scheduleOptionExpiryNotification = async (optionData: any): Promise<void> => {
    try {
      const expiryDate = new Date(optionData.expiry)
      await notificationService.scheduleOptionExpiryNotification(
        optionData.id,
        optionData.symbol,
        optionData.strike,
        optionData.type,
        expiryDate
      )
    } catch (error) {
      console.error('Failed to schedule option expiry notification:', error)
      throw error
    }
  }

  const requestPermissions = async (): Promise<boolean> => {
    try {
      return await notificationService.requestPermissions()
    } catch (error) {
      console.error('Failed to request permissions:', error)
      return false
    }
  }

  const contextValue: NotificationContextType = {
    isReady,
    pushToken,
    priceAlerts,
    createPriceAlert,
    deletePriceAlert,
    updatePriceAlert,
    scheduleVaultNotification,
    scheduleOptionExpiryNotification,
    requestPermissions,
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext