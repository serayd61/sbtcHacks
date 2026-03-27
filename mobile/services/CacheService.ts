import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'

export interface CacheItem<T = any> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
  key: string
}

export interface CacheConfig {
  defaultTTL: number // Default cache duration
  maxSize: number // Maximum cache size in MB
  enableOfflineMode: boolean
}

class CacheService {
  private config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes default
    maxSize: 50, // 50MB max
    enableOfflineMode: true,
  }

  private memoryCache: Map<string, CacheItem> = new Map()
  private isOnline: boolean = true

  constructor() {
    this.setupNetworkListener()
    this.loadMemoryCacheFromStorage()
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected || false
      console.log('Network status changed:', this.isOnline ? 'online' : 'offline')
    })
  }

  private async loadMemoryCacheFromStorage(): Promise<void> {
    try {
      const cacheKeys = await this.getCacheKeys()
      
      for (const key of cacheKeys) {
        const item = await this.getFromStorage(key)
        if (item && !this.isExpired(item)) {
          this.memoryCache.set(key, item)
        }
      }
      
      console.log(`Loaded ${this.memoryCache.size} items to memory cache`)
    } catch (error) {
      console.error('Failed to load memory cache:', error)
    }
  }

  private async getCacheKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      return allKeys.filter(key => key.startsWith('cache_'))
    } catch (error) {
      console.error('Failed to get cache keys:', error)
      return []
    }
  }

  private isExpired(item: CacheItem): boolean {
    return Date.now() - item.timestamp > item.ttl
  }

  private async getFromStorage(key: string): Promise<CacheItem | null> {
    try {
      const item = await AsyncStorage.getItem(`cache_${key}`)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error(`Failed to get item from storage: ${key}`, error)
      return null
    }
  }

  private async saveToStorage(key: string, item: CacheItem): Promise<void> {
    try {
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(item))
    } catch (error) {
      console.error(`Failed to save item to storage: ${key}`, error)
    }
  }

  private async removeFromStorage(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`cache_${key}`)
    } catch (error) {
      console.error(`Failed to remove item from storage: ${key}`, error)
    }
  }

  // Public methods
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      key,
    }

    // Save to memory cache
    this.memoryCache.set(key, cacheItem)

    // Save to persistent storage
    await this.saveToStorage(key, cacheItem)

    // Clean up if cache is getting too large
    await this.cleanupCache()
  }

  async get<T>(key: string, fallbackData?: T): Promise<T | null> {
    // First check memory cache
    let item = this.memoryCache.get(key)

    // If not in memory, check storage
    if (!item) {
      item = await this.getFromStorage(key)
      if (item && !this.isExpired(item)) {
        // Re-add to memory cache
        this.memoryCache.set(key, item)
      }
    }

    // Check if item exists and is not expired
    if (item && !this.isExpired(item)) {
      return item.data as T
    }

    // Item is expired, remove it
    if (item) {
      await this.remove(key)
    }

    // Return fallback data if provided
    return fallbackData || null
  }

  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key)
    await this.removeFromStorage(key)
  }

  async clear(): Promise<void> {
    this.memoryCache.clear()
    
    try {
      const cacheKeys = await this.getCacheKeys()
      await AsyncStorage.multiRemove(cacheKeys)
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  async getOrFetch<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
    forceRefresh = false
  ): Promise<T> {
    // If offline and we have cached data, return it even if expired
    if (!this.isOnline) {
      const cachedData = await this.get<T>(key)
      if (cachedData !== null) {
        console.log(`Returning cached data for ${key} (offline mode)`)
        return cachedData
      }
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = await this.get<T>(key)
      if (cachedData !== null) {
        return cachedData
      }
    }

    try {
      // Fetch new data
      const freshData = await fetchFunction()
      
      // Cache the result
      await this.set(key, freshData, ttl)
      
      return freshData
    } catch (error) {
      console.error(`Failed to fetch data for ${key}:`, error)
      
      // If fetch fails and we're offline, try to return cached data
      if (!this.isOnline) {
        const cachedData = await this.get<T>(key)
        if (cachedData !== null) {
          console.log(`Returning stale cached data for ${key} (fetch failed, offline)`)
          return cachedData
        }
      }
      
      throw error
    }
  }

  private async cleanupCache(): Promise<void> {
    try {
      const cacheKeys = await this.getCacheKeys()
      const cacheSize = await this.getCacheSize()
      
      // If cache is too large, remove oldest items
      if (cacheSize > this.config.maxSize) {
        console.log(`Cache size ${cacheSize}MB exceeds limit, cleaning up...`)
        
        // Get all cache items with timestamps
        const items = await Promise.all(
          cacheKeys.map(async key => ({
            key,
            item: await this.getFromStorage(key.replace('cache_', ''))
          }))
        )
        
        // Sort by timestamp (oldest first)
        const sortedItems = items
          .filter(({ item }) => item !== null)
          .sort((a, b) => a.item!.timestamp - b.item!.timestamp)
        
        // Remove oldest 25% of items
        const itemsToRemove = Math.floor(sortedItems.length * 0.25)
        for (let i = 0; i < itemsToRemove; i++) {
          const { key, item } = sortedItems[i]
          if (item) {
            await this.remove(item.key)
          }
        }
        
        console.log(`Removed ${itemsToRemove} old cache items`)
      }
      
      // Remove expired items
      await this.removeExpiredItems()
    } catch (error) {
      console.error('Failed to cleanup cache:', error)
    }
  }

  private async removeExpiredItems(): Promise<void> {
    const expiredKeys: string[] = []
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (this.isExpired(item)) {
        expiredKeys.push(key)
      }
    }
    
    for (const key of expiredKeys) {
      await this.remove(key)
    }
    
    if (expiredKeys.length > 0) {
      console.log(`Removed ${expiredKeys.length} expired cache items`)
    }
  }

  private async getCacheSize(): Promise<number> {
    try {
      const cacheKeys = await this.getCacheKeys()
      let totalSize = 0
      
      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key)
        if (item) {
          totalSize += new Blob([item]).size
        }
      }
      
      return totalSize / (1024 * 1024) // Convert to MB
    } catch (error) {
      console.error('Failed to calculate cache size:', error)
      return 0
    }
  }

  // Specialized caching methods for different data types
  async cacheVaultData(vaultData: any): Promise<void> {
    await this.set('vault_info', vaultData, 2 * 60 * 1000) // 2 minutes
  }

  async getCachedVaultData(): Promise<any> {
    return this.get('vault_info')
  }

  async cachePortfolioData(portfolioData: any): Promise<void> {
    await this.set('portfolio_data', portfolioData, 1 * 60 * 1000) // 1 minute
  }

  async getCachedPortfolioData(): Promise<any> {
    return this.get('portfolio_data')
  }

  async cacheOptionsData(optionsData: any): Promise<void> {
    await this.set('options_data', optionsData, 30 * 1000) // 30 seconds
  }

  async getCachedOptionsData(): Promise<any> {
    return this.get('options_data')
  }

  async cachePriceData(symbol: string, priceData: any): Promise<void> {
    await this.set(`price_${symbol}`, priceData, 15 * 1000) // 15 seconds
  }

  async getCachedPriceData(symbol: string): Promise<any> {
    return this.get(`price_${symbol}`)
  }

  async cacheUserData(userAddress: string, userData: any): Promise<void> {
    await this.set(`user_${userAddress}`, userData, 5 * 60 * 1000) // 5 minutes
  }

  async getCachedUserData(userAddress: string): Promise<any> {
    return this.get(`user_${userAddress}`)
  }

  // Offline mode utilities
  isOffline(): boolean {
    return !this.isOnline
  }

  async getOfflineData(): Promise<{ [key: string]: any }> {
    const offlineData: { [key: string]: any } = {}
    
    // Get essential data for offline mode
    const keys = [
      'vault_info',
      'portfolio_data',
      'options_data',
      'price_BTC',
      'price_SBTC'
    ]
    
    for (const key of keys) {
      const data = await this.get(key)
      if (data !== null) {
        offlineData[key] = data
      }
    }
    
    return offlineData
  }

  // Cache statistics
  async getCacheStats(): Promise<{
    totalItems: number
    memoryItems: number
    cacheSize: number
    isOnline: boolean
  }> {
    const cacheKeys = await this.getCacheKeys()
    const cacheSize = await this.getCacheSize()
    
    return {
      totalItems: cacheKeys.length,
      memoryItems: this.memoryCache.size,
      cacheSize,
      isOnline: this.isOnline,
    }
  }

  // Configuration
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): CacheConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const cacheService = new CacheService()
export default cacheService