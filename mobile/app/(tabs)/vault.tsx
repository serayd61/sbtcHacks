import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { useSelector, useDispatch } from 'react-redux'

import { RootState } from '../../store/store'
import { updateVaultInfo } from '../../store/vaultSlice'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ActionSheet } from '../../components/ui/ActionSheet'

interface VaultMetrics {
  tvl: number
  apy: number
  sharePrice: number
  totalShares: number
  currentEpoch: number
  nextEpochStart: string
  strategy: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export default function VaultScreen() {
  const dispatch = useDispatch()
  const vaultInfo = useSelector((state: RootState) => state.vault)
  
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [vaultMetrics, setVaultMetrics] = useState<VaultMetrics>({
    tvl: 2450000,
    apy: 18.5,
    sharePrice: 142.36,
    totalShares: 17234,
    currentEpoch: 5,
    nextEpochStart: '2024-01-26T08:00:00Z',
    strategy: 'Covered Call + Cash Secured Puts',
    riskLevel: 'MEDIUM'
  })

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

    loadVaultData()
  }, [])

  const loadVaultData = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data update
      const mockMetrics = {
        ...vaultMetrics,
        tvl: vaultMetrics.tvl + (Math.random() - 0.5) * 50000,
        apy: vaultMetrics.apy + (Math.random() - 0.5) * 2,
        sharePrice: vaultMetrics.sharePrice + (Math.random() - 0.5) * 5,
      }
      
      setVaultMetrics(mockMetrics)
      dispatch(updateVaultInfo(mockMetrics))
    } catch (error) {
      console.error('Failed to load vault data:', error)
    }
  }

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to deposit')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    
    try {
      // Simulate deposit transaction
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      Alert.alert(
        'Deposit Successful',
        `Successfully deposited ${amount} sBTC to the vault`,
        [{ text: 'OK', onPress: () => setAmount('') }]
      )
      
      // Refresh vault data
      await loadVaultData()
    } catch (error) {
      Alert.alert('Deposit Failed', 'Failed to deposit to vault. Please try again.')
    } finally {
      setLoading(false)
      Keyboard.dismiss()
    }
  }

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    
    try {
      // Simulate withdraw transaction
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      Alert.alert(
        'Withdrawal Successful',
        `Successfully withdrew ${amount} sBTC from the vault`,
        [{ text: 'OK', onPress: () => setAmount('') }]
      )
      
      await loadVaultData()
    } catch (error) {
      Alert.alert('Withdrawal Failed', 'Failed to withdraw from vault. Please try again.')
    } finally {
      setLoading(false)
      Keyboard.dismiss()
    }
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
    return `${value.toFixed(2)}%`
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return '#10B981'
      case 'MEDIUM': return '#F59E0B'
      case 'HIGH': return '#EF4444'
      default: return '#6B7280'
    }
  }

  const getTimeUntilNextEpoch = () => {
    const now = new Date()
    const nextEpoch = new Date(vaultMetrics.nextEpochStart)
    const diff = nextEpoch.getTime() - now.getTime()
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    return `${days}d ${hours}h`
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Vault Summary */}
        <Animated.View 
          style={[
            styles.summaryContainer,
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
            colors={['#1E40AF', '#3B82F6']}
            style={styles.summaryGradient}
          >
            <Text style={styles.summaryLabel}>Total Value Locked</Text>
            <Text style={styles.summaryValue}>{formatCurrency(vaultMetrics.tvl)}</Text>
            <View style={styles.apyContainer}>
              <Text style={styles.apyLabel}>Current APY</Text>
              <Text style={styles.apyValue}>{formatPercent(vaultMetrics.apy)}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Vault Metrics */}
        <Animated.View style={[styles.metricsContainer, { opacity: fadeAnim }]}>
          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Ionicons name="pie-chart" size={20} color="#F97316" />
              <Text style={styles.metricLabel}>Share Price</Text>
              <Text style={styles.metricValue}>${vaultMetrics.sharePrice.toFixed(2)}</Text>
            </View>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Ionicons name="layers" size={20} color="#10B981" />
              <Text style={styles.metricLabel}>Total Shares</Text>
              <Text style={styles.metricValue}>{vaultMetrics.totalShares.toLocaleString()}</Text>
            </View>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Ionicons name="time" size={20} color="#8B5CF6" />
              <Text style={styles.metricLabel}>Epoch {vaultMetrics.currentEpoch}</Text>
              <Text style={styles.metricValue}>{getTimeUntilNextEpoch()}</Text>
            </View>
          </Card>
        </Animated.View>

        {/* Strategy Info */}
        <Card style={styles.strategyContainer}>
          <View style={styles.strategyHeader}>
            <Text style={styles.sectionTitle}>Current Strategy</Text>
            <TouchableOpacity onPress={() => setShowActionSheet(true)}>
              <View style={[styles.riskBadge, { backgroundColor: getRiskColor(vaultMetrics.riskLevel) }]}>
                <Text style={styles.riskText}>{vaultMetrics.riskLevel} RISK</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.strategyName}>{vaultMetrics.strategy}</Text>
          <Text style={styles.strategyDescription}>
            Automated covered call writing with cash-secured put selling for enhanced yield generation
          </Text>

          <TouchableOpacity style={styles.strategyDetailsButton}>
            <Text style={styles.strategyDetailsText}>View Strategy Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#F97316" />
          </TouchableOpacity>
        </Card>

        {/* Deposit/Withdraw */}
        <Card style={styles.actionContainer}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'deposit' && styles.activeTab
              ]}
              onPress={() => setActiveTab('deposit')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'deposit' && styles.activeTabText
              ]}>
                Deposit
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'withdraw' && styles.activeTab
              ]}
              onPress={() => setActiveTab('withdraw')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'withdraw' && styles.activeTabText
              ]}>
                Withdraw
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {activeTab === 'deposit' ? 'sBTC Amount' : 'Shares to Withdraw'}
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                maxLength={10}
              />
              <TouchableOpacity style={styles.maxButton}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceText}>
              Available: {activeTab === 'deposit' ? '2.5431 sBTC' : '156.78 shares'}
            </Text>
          </View>

          <Button
            title={activeTab === 'deposit' ? 'Deposit to Vault' : 'Withdraw from Vault'}
            onPress={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
            loading={loading}
            style={styles.actionButton}
          />
        </Card>

        {/* Performance History */}
        <Card style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>Recent Performance</Text>
          
          <View style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyDate}>Epoch 4</Text>
              <Text style={styles.historyStrategy}>Covered Calls</Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyReturn, { color: '#10B981' }]}>+12.4%</Text>
              <Text style={styles.historyAmount}>+$1,245</Text>
            </View>
          </View>

          <View style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyDate}>Epoch 3</Text>
              <Text style={styles.historyStrategy}>Iron Condors</Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyReturn, { color: '#10B981' }]}>+8.7%</Text>
              <Text style={styles.historyAmount}>+$876</Text>
            </View>
          </View>

          <View style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyDate}>Epoch 2</Text>
              <Text style={styles.historyStrategy}>Cash Secured Puts</Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyReturn, { color: '#EF4444' }]}>-2.1%</Text>
              <Text style={styles.historyAmount}>-$213</Text>
            </View>
          </View>
        </Card>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        title="Strategy Information"
        subtitle="Current vault strategy details"
        actions={[
          {
            title: 'View Strategy Performance',
            icon: 'stats-chart',
            onPress: () => console.log('View performance')
          },
          {
            title: 'Risk Analysis',
            icon: 'shield-checkmark',
            onPress: () => console.log('Risk analysis')
          },
          {
            title: 'Strategy History',
            icon: 'time',
            onPress: () => console.log('Strategy history')
          }
        ]}
      />
    </KeyboardAvoidingView>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    fontFamily: 'Inter-Bold',
  },
  apyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apyLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginRight: 8,
    fontFamily: 'Inter-Regular',
  },
  apyValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: 'Inter-Bold',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
  },
  metricRow: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  strategyContainer: {
    margin: 16,
    marginBottom: 0,
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Inter-Bold',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: 'Inter-Bold',
  },
  strategyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  strategyDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  strategyDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  strategyDetailsText: {
    fontSize: 14,
    color: '#F97316',
    fontWeight: '600',
    marginRight: 4,
    fontFamily: 'Inter-Medium',
  },
  actionContainer: {
    margin: 16,
    marginBottom: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  activeTabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
  },
  maxButton: {
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F97316',
    borderRadius: 6,
  },
  maxButtonText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  balanceText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
  actionButton: {
    marginTop: 8,
  },
  historyContainer: {
    margin: 16,
    marginBottom: 0,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-Medium',
  },
  historyStrategy: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyReturn: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  historyAmount: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  bottomSpacing: {
    height: 32,
  },
})