import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { LineChart, PieChart } from 'react-native-chart-kit'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useSelector, useDispatch } from 'react-redux'

import { RootState } from '../../store/store'
import { updatePortfolio, updatePrices } from '../../store/portfolioSlice'
import { Card } from '../../components/ui/Card'
import { MetricCard } from '../../components/ui/MetricCard'
import { OptionCard } from '../../components/options/OptionCard'

const { width } = Dimensions.get('window')

interface PortfolioData {
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  btcBalance: number
  sbtcBalance: number
  vaultShares: number
  activeOptions: number
}

interface ChartData {
  labels: string[]
  datasets: [{ data: number[] }]
}

export default function PortfolioScreen() {
  const dispatch = useDispatch()
  const portfolio = useSelector((state: RootState) => state.portfolio)
  
  const [refreshing, setRefreshing] = useState(false)
  const [portfolioData, setPortfolioData] = useState<PortfolioData>({
    totalValue: 125430,
    totalPnL: 12543,
    totalPnLPercent: 11.2,
    btcBalance: 1.2543,
    sbtcBalance: 0.8234,
    vaultShares: 156.78,
    activeOptions: 3
  })
  
  const [chartData, setChartData] = useState<ChartData>({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      data: [112000, 118000, 125000, 119000, 123000, 125430]
    }]
  })

  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Animate portfolio cards entrance
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start()

    loadPortfolioData()
  }, [])

  const loadPortfolioData = async () => {
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In real app, would fetch from API
      const mockData = {
        totalValue: 125430 + (Math.random() - 0.5) * 1000,
        totalPnL: 12543 + (Math.random() - 0.5) * 500,
        totalPnLPercent: 11.2 + (Math.random() - 0.5) * 2,
        btcBalance: 1.2543,
        sbtcBalance: 0.8234,
        vaultShares: 156.78,
        activeOptions: 3
      }
      
      setPortfolioData(mockData)
      dispatch(updatePortfolio(mockData))
    } catch (error) {
      console.error('Failed to load portfolio data:', error)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadPortfolioData()
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

  const formatBTC = (value: number) => {
    return `${value.toFixed(4)} BTC`
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Portfolio Summary */}
      <Animated.View 
        style={[
          styles.summaryContainer,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0]
              })
            }]
          }
        ]}
      >
        <LinearGradient
          colors={['#F97316', '#EA580C']}
          style={styles.summaryGradient}
        >
          <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(portfolioData.totalValue)}</Text>
          <View style={styles.pnlContainer}>
            <Text style={[
              styles.pnlText,
              { color: portfolioData.totalPnL >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              {formatCurrency(portfolioData.totalPnL)} ({formatPercent(portfolioData.totalPnLPercent)})
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View 
        style={[
          styles.actionsContainer,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/vault')}
        >
          <Ionicons name="add-circle" size={24} color="#F97316" />
          <Text style={styles.actionText}>Deposit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/options')}
        >
          <Ionicons name="trending-up" size={24} color="#F97316" />
          <Text style={styles.actionText}>Trade</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/farming')}
        >
          <Ionicons name="leaf" size={24} color="#F97316" />
          <Text style={styles.actionText}>Farm</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/strategies/create')}
        >
          <Ionicons name="bulb" size={24} color="#F97316" />
          <Text style={styles.actionText}>Strategy</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Performance Chart */}
      <Card style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Performance (6M)</Text>
        <LineChart
          data={chartData}
          width={width - 64}
          height={220}
          chartConfig={{
            backgroundColor: '#FFF',
            backgroundGradientFrom: '#FFF',
            backgroundGradientTo: '#FFF',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#F97316',
            },
          }}
          bezier
          style={styles.chart}
        />
      </Card>

      {/* Holdings */}
      <Card style={styles.holdingsContainer}>
        <Text style={styles.sectionTitle}>Holdings</Text>
        
        <View style={styles.holdingRow}>
          <View style={styles.holdingInfo}>
            <Ionicons name="logo-bitcoin" size={24} color="#F7931A" />
            <View style={styles.holdingDetails}>
              <Text style={styles.holdingName}>Bitcoin</Text>
              <Text style={styles.holdingSymbol}>BTC</Text>
            </View>
          </View>
          <View style={styles.holdingValues}>
            <Text style={styles.holdingAmount}>{formatBTC(portfolioData.btcBalance)}</Text>
            <Text style={styles.holdingValue}>{formatCurrency(portfolioData.btcBalance * 95000)}</Text>
          </View>
        </View>

        <View style={styles.holdingRow}>
          <View style={styles.holdingInfo}>
            <View style={styles.sbtcIcon}>
              <Text style={styles.sbtcIconText}>s₿</Text>
            </View>
            <View style={styles.holdingDetails}>
              <Text style={styles.holdingName}>Synthetic Bitcoin</Text>
              <Text style={styles.holdingSymbol}>sBTC</Text>
            </View>
          </View>
          <View style={styles.holdingValues}>
            <Text style={styles.holdingAmount}>{formatBTC(portfolioData.sbtcBalance)}</Text>
            <Text style={styles.holdingValue}>{formatCurrency(portfolioData.sbtcBalance * 95000)}</Text>
          </View>
        </View>

        <View style={styles.holdingRow}>
          <View style={styles.holdingInfo}>
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <View style={styles.holdingDetails}>
              <Text style={styles.holdingName}>Vault Shares</Text>
              <Text style={styles.holdingSymbol}>SHARES</Text>
            </View>
          </View>
          <View style={styles.holdingValues}>
            <Text style={styles.holdingAmount}>{portfolioData.vaultShares.toFixed(2)}</Text>
            <Text style={styles.holdingValue}>{formatCurrency(portfolioData.vaultShares * 142)}</Text>
          </View>
        </View>
      </Card>

      {/* Active Options */}
      <Card style={styles.optionsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Options ({portfolioData.activeOptions})</Text>
          <TouchableOpacity onPress={() => router.push('/options')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {/* Mock option data */}
        <OptionCard
          id="1"
          type="CALL"
          strike={100000}
          premium={2500}
          expiry="2024-01-26"
          pnl={850}
          status="ITM"
        />
        
        <OptionCard
          id="2"
          type="PUT"
          strike={90000}
          premium={1800}
          expiry="2024-01-26"
          pnl={-320}
          status="OTM"
        />
      </Card>

      {/* Bottom spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  summaryContainer: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: 24,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  pnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pnlText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    marginTop: 4,
    fontFamily: 'Inter-Medium',
  },
  chartContainer: {
    margin: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'Inter-Bold',
  },
  chart: {
    borderRadius: 16,
  },
  holdingsContainer: {
    margin: 16,
    marginBottom: 0,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  holdingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  holdingDetails: {
    marginLeft: 12,
  },
  holdingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-Medium',
  },
  holdingSymbol: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  holdingValues: {
    alignItems: 'flex-end',
  },
  holdingAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-Medium',
  },
  holdingValue: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  sbtcIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sbtcIconText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
  },
  optionsContainer: {
    margin: 16,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#F97316',
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  },
  bottomSpacing: {
    height: 32,
  },
})