import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface Holding {
  symbol: string
  name: string
  amount: number
  value: number
  change24h: number
}

interface PortfolioState {
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  holdings: Holding[]
  isLoading: boolean
  lastUpdated: number | null
}

const initialState: PortfolioState = {
  totalValue: 0,
  totalPnL: 0,
  totalPnLPercent: 0,
  holdings: [],
  isLoading: false,
  lastUpdated: null,
}

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    updatePortfolio: (state, action: PayloadAction<Partial<PortfolioState>>) => {
      Object.assign(state, action.payload)
      state.lastUpdated = Date.now()
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    updateHolding: (state, action: PayloadAction<Holding>) => {
      const index = state.holdings.findIndex(h => h.symbol === action.payload.symbol)
      if (index >= 0) {
        state.holdings[index] = action.payload
      } else {
        state.holdings.push(action.payload)
      }
      state.lastUpdated = Date.now()
    },
    removeHolding: (state, action: PayloadAction<string>) => {
      state.holdings = state.holdings.filter(h => h.symbol !== action.payload)
      state.lastUpdated = Date.now()
    },
    updatePrices: (state, action: PayloadAction<Record<string, number>>) => {
      state.holdings = state.holdings.map(holding => ({
        ...holding,
        value: holding.amount * (action.payload[holding.symbol] || 0)
      }))
      
      // Recalculate totals
      state.totalValue = state.holdings.reduce((sum, holding) => sum + holding.value, 0)
      state.lastUpdated = Date.now()
    },
  },
})

export const { 
  updatePortfolio, 
  setLoading, 
  updateHolding, 
  removeHolding, 
  updatePrices 
} = portfolioSlice.actions

export default portfolioSlice.reducer