import { configureStore } from '@reduxjs/toolkit'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { persistStore, persistReducer } from 'redux-persist'
import { combineReducers } from '@reduxjs/toolkit'

import portfolioSlice from './portfolioSlice'
import vaultSlice from './vaultSlice'
import optionsSlice from './optionsSlice'
import farmingSlice from './farmingSlice'
import userSlice from './userSlice'
import notificationSlice from './notificationSlice'

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['user', 'portfolio', 'vault'], // Only persist these slices
}

const rootReducer = combineReducers({
  portfolio: portfolioSlice,
  vault: vaultSlice,
  options: optionsSlice,
  farming: farmingSlice,
  user: userSlice,
  notifications: notificationSlice,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: __DEV__, // Enable Redux DevTools in development
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch