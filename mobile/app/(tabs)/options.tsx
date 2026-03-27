import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Animated,
  RefreshControl,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'

import { Card } from '../../components/ui/Card'
import { OptionItem } from '../../components/options/OptionItem'
import { FilterModal } from '../../components/options/FilterModal'

interface OptionData {
  id: string
  type: 'CALL' | 'PUT'
  strike: number
  premium: number
  expiry: string
  impliedVol: number
  delta: number
  gamma: number
  theta: number
  volume: number
  openInterest: number
  bid: number
  ask: number
  lastPrice: number
  moneyness: number
}

interface MarketData {
  btcPrice: number
  btcChange24h: number
  impliedVol: number
  volChange24h: number
  totalVolume: number
  totalOpenInterest: number
  nextExpiry: string
}

export default function OptionsScreen() {
  const [activeTab, setActiveTab] = useState<'calls' | 'puts' | 'strategies'>('calls')
  const [showFilters, setShowFilters] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedExpiry, setSelectedExpiry] = useState('2024-01-26')
  
  const [marketData, setMarketData] = useState<MarketData>({
    btcPrice: 95234.50,
    btcChange24h: 2.3,
    impliedVol: 82.5,
    volChange24h: -1.2,
    totalVolume: 15234000,
    totalOpenInterest: 45678000,
    nextExpiry: '2024-01-26'
  })

  const [optionsData, setOptionsData] = useState<OptionData[]>([
    {
      id: '1',
      type: 'CALL',
      strike: 100000,
      premium: 2500,
      expiry: '2024-01-26',
      impliedVol: 85.2,
      delta: 0.65,
      gamma: 0.008,
      theta: -12.5,
      volume: 150,
      openInterest: 450,
      bid: 2450,
      ask: 2550,
      lastPrice: 2500,
      moneyness: 1.05
    },
    {
      id: '2',
      type: 'CALL',
      strike: 105000,
      premium: 1850,
      expiry: '2024-01-26',
      impliedVol: 82.8,
      delta: 0.45,
      gamma: 0.012,
      theta: -8.3,
      volume: 89,
      openInterest: 320,
      bid: 1800,
      ask: 1900,
      lastPrice: 1850,
      moneyness: 1.10
    },
    {
      id: '3',
      type: 'PUT',
      strike: 90000,
      premium: 1800,
      expiry: '2024-01-26',
      impliedVol: 78.5,
      delta: -0.35,
      gamma: 0.006,
      theta: -8.2,
      volume: 67,
      openInterest: 280,
      bid: 1750,
      ask: 1850,
      lastPrice: 1800,
      moneyness: 0.95
    }
  ])

  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()

    loadMarketData()
  }, [])

  const loadMarketData = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data update
      const mockData = {
        ...marketData,
        btcPrice: marketData.btcPrice + (Math.random() - 0.5) * 1000,
        btcChange24h: marketData.btcChange24h + (Math.random() - 0.5) * 2,
        impliedVol: marketData.impliedVol + (Math.random() - 0.5) * 5,
      }
      
      setMarketData(mockData)
    } catch (error) {
      console.error('Failed to load market data:', error)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadMarketData()
    setRefreshing(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  const filteredOptions = optionsData.filter(option => {
    if (activeTab === 'strategies') return false
    return option.type === (activeTab === 'calls' ? 'CALL' : 'PUT')
  })

  const expiryDates = ['2024-01-26', '2024-02-02', '2024-02-09', '2024-02-16']

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Market Overview */}
        <Animated.View 
          style={[
            styles.marketContainer,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0]
                })
              }]
            }
          ]}
        >
          <LinearGradient
            colors={['#7C3AED', '#A855F7']}
            style={styles.marketGradient}
          >
            <View style={styles.marketHeader}>
              <View>
                <Text style={styles.marketLabel}>BTC Price</Text>
                <Text style={styles.marketPrice}>{formatCurrency(marketData.btcPrice)}</Text>
              </View>
              <View style={styles.marketChange}>
                <Text style={[
                  styles.marketChangeText,
                  { color: marketData.btcChange24h >= 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {formatPercent(marketData.btcChange24h)}
                </Text>
              </View>
            </View>

            <View style={styles.marketStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Implied Vol</Text>
                <Text style={styles.statValue}>{marketData.impliedVol.toFixed(1)}%</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Volume 24h</Text>
                <Text style={styles.statValue}>{formatCurrency(marketData.totalVolume)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Open Interest</Text>
                <Text style={styles.statValue}>{formatCurrency(marketData.totalOpenInterest)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Tabs */}
        <Animated.View style={[styles.tabsContainer, { opacity: fadeAnim }]}>
          <View style={styles.tabsWrapper}>
            {['calls', 'puts', 'strategies'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.activeTab
                ]}
                onPress={() => setActiveTab(tab as any)}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText
                ]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color="#F97316" />
          </TouchableOpacity>
        </Animated.View>

        {/* Expiry Selection */}
        <View style={styles.expiryContainer}>
          <Text style={styles.expiryLabel}>Expiry Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.expiryScroll}
          >
            {expiryDates.map((date) => (
              <TouchableOpacity
                key={date}
                style={[
                  styles.expiryButton,
                  selectedExpiry === date && styles.selectedExpiry
                ]}
                onPress={() => setSelectedExpiry(date)}
              >
                <Text style={[
                  styles.expiryText,
                  selectedExpiry === date && styles.selectedExpiryText
                ]}>
                  {new Date(date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Options Chain or Strategies */}
        <Card style={styles.optionsContainer}>
          {activeTab !== 'strategies' ? (
            <>
              {/* Options Chain Header */}
              <View style={styles.chainHeader}>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Strike</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Premium</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>IV</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Delta</Text>
                </View>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>Volume</Text>
                </View>
              </View>

              {/* Options List */}
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <OptionItem
                    option={item}
                    onPress={() => router.push(`/options/${item.id}`)}
                  />
                )}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          ) : (
            /* Strategies View */
            <View style={styles.strategiesContainer}>
              <TouchableOpacity 
                style={styles.strategyItem}
                onPress={() => router.push('/strategies/create?type=iron-condor')}
              >
                <View style={styles.strategyInfo}>
                  <Text style={styles.strategyName}>Iron Condor</Text>
                  <Text style={styles.strategyDesc}>Limited risk, limited reward</Text>
                </View>
                <View style={styles.strategyMetrics}>
                  <Text style={styles.strategyMetric}>Max Profit: $500</Text>
                  <Text style={styles.strategyMetric}>Probability: 68%</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.strategyItem}
                onPress={() => router.push('/strategies/create?type=straddle')}
              >
                <View style={styles.strategyInfo}>
                  <Text style={styles.strategyName}>Long Straddle</Text>
                  <Text style={styles.strategyDesc}>High volatility play</Text>
                </View>
                <View style={styles.strategyMetrics}>
                  <Text style={styles.strategyMetric}>Breakeven: ±8%</Text>
                  <Text style={styles.strategyMetric}>Cost: $4,200</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.strategyItem}
                onPress={() => router.push('/strategies/create?type=collar')}
              >
                <View style={styles.strategyInfo}>
                  <Text style={styles.strategyName}>Collar</Text>
                  <Text style={styles.strategyDesc}>Protected position</Text>
                </View>
                <View style={styles.strategyMetrics}>
                  <Text style={styles.strategyMetric}>Protection: 95k</Text>
                  <Text style={styles.strategyMetric}>Upside: 105k</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}
        </Card>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApplyFilters={(filters) => {
          console.log('Applied filters:', filters)
          setShowFilters(false)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  marketContainer: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  marketGradient: {
    padding: 20,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  marketLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  marketPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: 'Inter-Bold',
  },
  marketChange: {
    alignItems: 'flex-end',
  },
  marketChangeText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  marketStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: 'Inter-Bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    flex: 1,
    marginRight: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#F97316',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expiryContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  expiryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  expiryScroll: {
    flexGrow: 0,
  },
  expiryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedExpiry: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  expiryText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  selectedExpiryText: {
    color: '#FFF',
  },
  optionsContainer: {
    margin: 16,
    marginBottom: 0,
    padding: 0,
  },
  chainHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 16,
  },
  strategiesContainer: {
    padding: 16,
  },
  strategyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  strategyInfo: {
    flex: 1,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  strategyDesc: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  strategyMetrics: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  strategyMetric: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  bottomSpacing: {
    height: 32,
  },
})