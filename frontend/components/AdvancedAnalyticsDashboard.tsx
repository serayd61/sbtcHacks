'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Line, Bar, Scatter } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ScatterController,
  Title,
  Tooltip,
  Legend
)

interface GreeksData {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

interface PortfolioMetrics {
  totalPnL: number
  unrealizedPnL: number
  realizedPnL: number
  totalVolume: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  avgReturn: number
  volatility: number
  greeks: GreeksData
}

interface OptionPosition {
  id: string
  type: 'CALL' | 'PUT'
  strike: number
  expiry: string
  premium: number
  quantity: number
  pnl: number
  greeks: GreeksData
  impliedVol: number
  moneyness: number
}

interface VolatilitySurfacePoint {
  strike: number
  expiry: number
  iv: number
  moneyness: number
}

interface PnLHistoryPoint {
  date: string
  pnl: number
  cumulativePnL: number
  sharpe: number
  drawdown: number
}

export default function AdvancedAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'greeks' | 'volatility' | 'positions' | 'performance'>('overview')
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d')
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null)
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [volatilitySurface, setVolatilitySurface] = useState<VolatilitySurfacePoint[]>([])
  const [pnlHistory, setPnlHistory] = useState<PnLHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulated data - replace with real API calls
    const loadAnalyticsData = async () => {
      setLoading(true)
      
      // Mock portfolio metrics
      setPortfolioMetrics({
        totalPnL: 12450,
        unrealizedPnL: 3200,
        realizedPnL: 9250,
        totalVolume: 145000,
        sharpeRatio: 1.85,
        maxDrawdown: -8.5,
        winRate: 72.4,
        avgReturn: 15.3,
        volatility: 28.7,
        greeks: {
          delta: 0.23,
          gamma: 0.012,
          theta: -45.6,
          vega: 1250,
          rho: 89
        }
      })

      // Mock positions data
      setPositions([
        {
          id: '1',
          type: 'CALL',
          strike: 95000,
          expiry: '2024-01-26',
          premium: 2500,
          quantity: 10,
          pnl: 850,
          greeks: { delta: 0.65, gamma: 0.008, theta: -12.5, vega: 450, rho: 25 },
          impliedVol: 82.5,
          moneyness: 1.05
        },
        {
          id: '2',
          type: 'PUT',
          strike: 90000,
          expiry: '2024-01-26',
          premium: 1800,
          quantity: 5,
          pnl: -320,
          greeks: { delta: -0.35, gamma: 0.006, theta: -8.2, vega: 280, rho: -15 },
          impliedVol: 78.2,
          moneyness: 0.95
        }
      ])

      // Mock volatility surface
      const mockVolSurface = []
      for (let strike = 80000; strike <= 110000; strike += 2500) {
        for (let days = 7; days <= 90; days += 7) {
          mockVolSurface.push({
            strike,
            expiry: days,
            iv: 60 + Math.random() * 40 + (Math.abs(strike - 95000) / 1000) * 2,
            moneyness: strike / 95000
          })
        }
      }
      setVolatilitySurface(mockVolSurface)

      // Mock P&L history
      const mockPnL: Array<{ date: string; pnl: number; cumulativePnL: number; sharpe: number; drawdown: number }> = []
      let cumulativePnL = 0
      for (let i = 0; i < 30; i++) {
        const dailyPnL = (Math.random() - 0.4) * 500 // Slight positive bias
        cumulativePnL += dailyPnL
        mockPnL.push({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          pnl: dailyPnL,
          cumulativePnL,
          sharpe: 1.2 + Math.random() * 1.0,
          drawdown: Math.min(0, cumulativePnL - Math.max(...mockPnL.slice(0, i + 1).map(p => p.cumulativePnL || 0)))
        })
      }
      setPnlHistory(mockPnL)

      setLoading(false)
    }

    loadAnalyticsData()
  }, [timeRange])

  // Chart configurations
  const pnlChartData = useMemo(() => ({
    labels: pnlHistory.map(p => p.date),
    datasets: [
      {
        label: 'Cumulative P&L',
        data: pnlHistory.map(p => p.cumulativePnL),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Daily P&L',
        data: pnlHistory.map(p => p.pnl),
        type: 'bar' as const,
        backgroundColor: pnlHistory.map(p => p.pnl >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
        yAxisID: 'y1'
      }
    ]
  }), [pnlHistory])

  const greeksChartData = useMemo(() => {
    if (!portfolioMetrics) return { labels: [], datasets: [] }
    
    return {
      labels: ['Delta', 'Gamma', 'Theta', 'Vega', 'Rho'],
      datasets: [{
        label: 'Greeks Values',
        data: [
          portfolioMetrics.greeks.delta,
          portfolioMetrics.greeks.gamma,
          portfolioMetrics.greeks.theta,
          portfolioMetrics.greeks.vega / 100, // Scale vega
          portfolioMetrics.greeks.rho / 10 // Scale rho
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.6)',
          'rgba(16, 185, 129, 0.6)',
          'rgba(245, 101, 101, 0.6)',
          'rgba(139, 92, 246, 0.6)',
          'rgba(245, 158, 11, 0.6)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 101, 101)',
          'rgb(139, 92, 246)',
          'rgb(245, 158, 11)'
        ],
        borderWidth: 1
      }]
    }
  }, [portfolioMetrics])

  const volatilitySurfaceData = useMemo(() => ({
    datasets: [{
      label: 'Implied Volatility',
      data: volatilitySurface.map(point => ({
        x: point.moneyness,
        y: point.expiry,
        v: point.iv // Custom property for color mapping
      })),
      backgroundColor: volatilitySurface.map(point => {
        const intensity = (point.iv - 60) / 40 // Normalize to 0-1
        return `rgba(${Math.round(255 * intensity)}, ${Math.round(100 * (1 - intensity))}, ${Math.round(150 * intensity)}, 0.7)`
      }),
      pointRadius: 6
    }]
  }), [volatilitySurface])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Analytics</h2>
        <div className="flex space-x-2">
          {['24h', '7d', '30d', '90d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                timeRange === range
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      {portfolioMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-90">Total P&L</div>
            <div className="text-2xl font-bold">{formatCurrency(portfolioMetrics.totalPnL)}</div>
            <div className="text-sm opacity-75">
              Realized: {formatCurrency(portfolioMetrics.realizedPnL)}
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-90">Sharpe Ratio</div>
            <div className="text-2xl font-bold">{portfolioMetrics.sharpeRatio.toFixed(2)}</div>
            <div className="text-sm opacity-75">
              Volatility: {formatPercent(portfolioMetrics.volatility)}
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-90">Win Rate</div>
            <div className="text-2xl font-bold">{formatPercent(portfolioMetrics.winRate)}</div>
            <div className="text-sm opacity-75">
              Avg Return: {formatPercent(portfolioMetrics.avgReturn)}
            </div>
          </div>
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-90">Max Drawdown</div>
            <div className="text-2xl font-bold">{formatPercent(portfolioMetrics.maxDrawdown)}</div>
            <div className="text-sm opacity-75">
              Volume: {formatCurrency(portfolioMetrics.totalVolume)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'greeks', label: 'Greeks', icon: '🔢' },
            { id: 'volatility', label: 'Volatility Surface', icon: '🌊' },
            { id: 'positions', label: 'Positions', icon: '📋' },
            { id: 'performance', label: 'Performance', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="h-96">
              <h3 className="text-lg font-semibold mb-4">P&L Performance</h3>
              <Line
                data={pnlChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' as const },
                    title: { display: false }
                  },
                  scales: {
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      grid: { drawOnChartArea: false },
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'greeks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Portfolio Greeks</h3>
                <Bar
                  data={greeksChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      title: { display: false }
                    }
                  }}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Greeks Explanation</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="font-medium text-blue-900">Delta: {portfolioMetrics?.greeks.delta.toFixed(3)}</div>
                    <div className="text-sm text-blue-700">Price sensitivity to underlying asset</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <div className="font-medium text-green-900">Gamma: {portfolioMetrics?.greeks.gamma.toFixed(3)}</div>
                    <div className="text-sm text-green-700">Rate of change of Delta</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded">
                    <div className="font-medium text-red-900">Theta: {portfolioMetrics?.greeks.theta.toFixed(1)}</div>
                    <div className="text-sm text-red-700">Time decay per day</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded">
                    <div className="font-medium text-purple-900">Vega: {portfolioMetrics?.greeks.vega.toFixed(0)}</div>
                    <div className="text-sm text-purple-700">Volatility sensitivity</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'volatility' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Implied Volatility Surface</h3>
              <div className="h-96">
                <Scatter
                  data={volatilitySurfaceData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top' as const },
                      title: { display: false }
                    },
                    scales: {
                      x: {
                        title: { display: true, text: 'Moneyness (Strike/Spot)' },
                        min: 0.8,
                        max: 1.2
                      },
                      y: {
                        title: { display: true, text: 'Days to Expiration' },
                        min: 0,
                        max: 100
                      }
                    }
                  }}
                />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p>Colors represent implied volatility levels - redder indicates higher IV, bluer indicates lower IV</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Active Positions</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strike</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P&L</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IV</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {positions.map((position) => (
                    <tr key={position.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          position.type === 'CALL' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {position.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(position.strike)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.expiry}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(position.pnl)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.greeks.delta.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercent(position.impliedVol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Risk Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Sharpe Ratio</span>
                    <span className="text-lg font-bold text-green-600">{portfolioMetrics?.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Max Drawdown</span>
                    <span className="text-lg font-bold text-red-600">{formatPercent(portfolioMetrics?.maxDrawdown || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Volatility</span>
                    <span className="text-lg font-bold text-blue-600">{formatPercent(portfolioMetrics?.volatility || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Win Rate</span>
                    <span className="text-lg font-bold text-purple-600">{formatPercent(portfolioMetrics?.winRate || 0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Strategy Attribution</h3>
                <div className="space-y-3">
                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                    <div className="font-medium text-blue-900">Covered Calls</div>
                    <div className="text-sm text-blue-700">65% allocation • +12.3% return</div>
                  </div>
                  <div className="p-3 border-l-4 border-green-500 bg-green-50">
                    <div className="font-medium text-green-900">Cash-Secured Puts</div>
                    <div className="text-sm text-green-700">20% allocation • +8.7% return</div>
                  </div>
                  <div className="p-3 border-l-4 border-purple-500 bg-purple-50">
                    <div className="font-medium text-purple-900">Iron Condors</div>
                    <div className="text-sm text-purple-700">10% allocation • +15.2% return</div>
                  </div>
                  <div className="p-3 border-l-4 border-orange-500 bg-orange-50">
                    <div className="font-medium text-orange-900">Straddles</div>
                    <div className="text-sm text-orange-700">5% allocation • -2.1% return</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}