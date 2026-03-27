import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export interface NotificationData {
  type: 'price_alert' | 'option_expiry' | 'strategy_update' | 'vault_update' | 'news'
  title: string
  body: string
  data?: Record<string, any>
}

export interface PriceAlert {
  id: string
  symbol: string
  condition: 'above' | 'below'
  targetPrice: number
  currentPrice: number
  enabled: boolean
  createdAt: number
}

class NotificationService {
  private expoPushToken: string | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Request permissions
      await this.requestPermissions()
      
      // Get push token
      this.expoPushToken = await this.registerForPushNotificationsAsync()
      
      // Load saved alerts
      await this.loadPriceAlerts()
      
      // Setup notification listeners
      this.setupNotificationListeners()
      
      this.isInitialized = true
      console.log('NotificationService initialized successfully')
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error)
    }
  }

  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions not granted')
      return false
    }

    return true
  }

  async registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Must use physical device for Push Notifications')
      return null
    }

    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Replace with your project ID
      })
      
      console.log('Expo push token:', token)
      
      // Store token locally and send to your backend
      await AsyncStorage.setItem('expo_push_token', token)
      await this.sendTokenToBackend(token)
      
      return token
    } catch (error) {
      console.error('Failed to get push token:', error)
      return null
    }
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      // Send token to your backend API
      // This would be your actual API endpoint
      const response = await fetch('https://your-api.com/register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          timestamp: Date.now(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to register token with backend')
      }
    } catch (error) {
      console.error('Failed to send token to backend:', error)
    }
  }

  private setupNotificationListeners(): void {
    // Handle notification received while app is open
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification)
      this.handleNotificationReceived(notification)
    })

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response)
      this.handleNotificationTapped(response)
    })
  }

  private handleNotificationReceived(notification: Notifications.Notification): void {
    const { data } = notification.request.content
    
    // Handle different notification types
    switch (data?.type) {
      case 'price_alert':
        this.handlePriceAlert(data)
        break
      case 'option_expiry':
        this.handleOptionExpiry(data)
        break
      case 'strategy_update':
        this.handleStrategyUpdate(data)
        break
      default:
        console.log('Unknown notification type:', data?.type)
    }
  }

  private handleNotificationTapped(response: Notifications.NotificationResponse): void {
    const { data } = response.notification.request.content
    
    // Navigate to relevant screen based on notification type
    // This would integrate with your navigation system
    console.log('Navigate to:', data?.screen || 'home')
  }

  private handlePriceAlert(data: any): void {
    console.log('Price alert triggered:', data)
    // Update price alert status if needed
  }

  private handleOptionExpiry(data: any): void {
    console.log('Option expiry alert:', data)
    // Handle option expiry notification
  }

  private handleStrategyUpdate(data: any): void {
    console.log('Strategy update:', data)
    // Handle strategy update notification
  }

  // Local notification methods
  async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, any>
  ): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
    })

    return notificationId
  }

  async cancelLocalNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  }

  async cancelAllLocalNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  // Price alerts
  async createPriceAlert(
    symbol: string,
    condition: 'above' | 'below',
    targetPrice: number
  ): Promise<PriceAlert> {
    const alert: PriceAlert = {
      id: `${symbol}_${condition}_${targetPrice}_${Date.now()}`,
      symbol,
      condition,
      targetPrice,
      currentPrice: 0, // Will be updated by price monitoring
      enabled: true,
      createdAt: Date.now(),
    }

    await this.savePriceAlert(alert)
    
    console.log(`Created price alert: ${symbol} ${condition} $${targetPrice}`)
    return alert
  }

  async updatePriceAlert(alertId: string, updates: Partial<PriceAlert>): Promise<void> {
    const alerts = await this.getPriceAlerts()
    const alertIndex = alerts.findIndex(a => a.id === alertId)
    
    if (alertIndex >= 0) {
      alerts[alertIndex] = { ...alerts[alertIndex], ...updates }
      await this.savePriceAlerts(alerts)
    }
  }

  async deletePriceAlert(alertId: string): Promise<void> {
    const alerts = await this.getPriceAlerts()
    const filteredAlerts = alerts.filter(a => a.id !== alertId)
    await this.savePriceAlerts(filteredAlerts)
  }

  async checkPriceAlerts(prices: Record<string, number>): Promise<void> {
    const alerts = await this.getPriceAlerts()
    
    for (const alert of alerts) {
      if (!alert.enabled) continue
      
      const currentPrice = prices[alert.symbol]
      if (!currentPrice) continue
      
      let shouldTrigger = false
      
      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true
      }
      
      if (shouldTrigger) {
        await this.triggerPriceAlert(alert, currentPrice)
        // Disable alert after triggering to prevent spam
        await this.updatePriceAlert(alert.id, { enabled: false })
      }
    }
  }

  private async triggerPriceAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    const title = `Price Alert: ${alert.symbol}`
    const body = `${alert.symbol} is now $${currentPrice.toFixed(2)} (target: $${alert.targetPrice})`
    
    await this.scheduleLocalNotification(
      title,
      body,
      { seconds: 1 }, // Immediate notification
      {
        type: 'price_alert',
        symbol: alert.symbol,
        price: currentPrice,
        screen: 'portfolio'
      }
    )
  }

  // Option expiry notifications
  async scheduleOptionExpiryNotification(
    optionId: string,
    symbol: string,
    strike: number,
    type: 'CALL' | 'PUT',
    expiryDate: Date
  ): Promise<void> {
    const now = new Date()
    const timeUntilExpiry = expiryDate.getTime() - now.getTime()
    
    // Schedule notifications at different intervals before expiry
    const notifications = [
      { hours: 24, message: '1 day until expiry' },
      { hours: 4, message: '4 hours until expiry' },
      { hours: 1, message: '1 hour until expiry' },
    ]
    
    for (const notification of notifications) {
      const triggerTime = new Date(expiryDate.getTime() - (notification.hours * 60 * 60 * 1000))
      
      if (triggerTime > now) {
        await this.scheduleLocalNotification(
          `Option Expiry Warning`,
          `${type} option ${symbol} $${strike} - ${notification.message}`,
          { date: triggerTime },
          {
            type: 'option_expiry',
            optionId,
            symbol,
            strike,
            screen: 'options'
          }
        )
      }
    }
  }

  // Vault update notifications
  async notifyVaultUpdate(
    type: 'deposit' | 'withdrawal' | 'epoch_start' | 'epoch_end',
    amount?: number,
    epoch?: number
  ): Promise<void> {
    let title = 'Vault Update'
    let body = ''
    
    switch (type) {
      case 'deposit':
        title = 'Deposit Successful'
        body = `Successfully deposited ${amount} sBTC to vault`
        break
      case 'withdrawal':
        title = 'Withdrawal Successful'
        body = `Successfully withdrew ${amount} sBTC from vault`
        break
      case 'epoch_start':
        title = 'New Epoch Started'
        body = `Epoch ${epoch} has started - new options strategies deployed`
        break
      case 'epoch_end':
        title = 'Epoch Ended'
        body = `Epoch ${epoch} has ended - check your returns!`
        break
    }
    
    await this.scheduleLocalNotification(
      title,
      body,
      { seconds: 1 },
      {
        type: 'vault_update',
        vault_action: type,
        screen: 'vault'
      }
    )
  }

  // Storage helpers
  private async savePriceAlert(alert: PriceAlert): Promise<void> {
    const alerts = await this.getPriceAlerts()
    alerts.push(alert)
    await this.savePriceAlerts(alerts)
  }

  private async savePriceAlerts(alerts: PriceAlert[]): Promise<void> {
    await AsyncStorage.setItem('price_alerts', JSON.stringify(alerts))
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    try {
      const alertsJson = await AsyncStorage.getItem('price_alerts')
      return alertsJson ? JSON.parse(alertsJson) : []
    } catch (error) {
      console.error('Failed to load price alerts:', error)
      return []
    }
  }

  private async loadPriceAlerts(): Promise<void> {
    const alerts = await this.getPriceAlerts()
    console.log(`Loaded ${alerts.length} price alerts`)
  }

  // Getters
  getPushToken(): string | null {
    return this.expoPushToken
  }

  isReady(): boolean {
    return this.isInitialized
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
export default notificationService