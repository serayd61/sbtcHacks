import { useFonts } from 'expo-font'
import { Stack, SplashScreen } from 'expo-router'
import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider } from 'react-redux'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Toast from 'react-native-toast-message'

import { store } from '../store/store'
import { AuthProvider } from '../contexts/AuthContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync()
    }
  }, [loaded, error])

  if (!loaded && !error) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AuthProvider>
            <NotificationProvider>
              <StatusBar style="auto" />
              <Stack
                screenOptions={{
                  headerStyle: {
                    backgroundColor: '#F97316',
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                    fontFamily: 'Inter-Bold'
                  },
                  headerBackTitleVisible: false,
                  animation: 'slide_from_right'
                }}
              >
                <Stack.Screen 
                  name="index" 
                  options={{ 
                    headerShown: false 
                  }} 
                />
                <Stack.Screen 
                  name="(tabs)" 
                  options={{ 
                    headerShown: false 
                  }} 
                />
                <Stack.Screen 
                  name="auth/login" 
                  options={{ 
                    title: 'Connect Wallet',
                    presentation: 'modal'
                  }} 
                />
                <Stack.Screen 
                  name="options/[id]" 
                  options={{ 
                    title: 'Option Details',
                    headerBackVisible: true
                  }} 
                />
                <Stack.Screen 
                  name="strategies/create" 
                  options={{ 
                    title: 'Create Strategy',
                    presentation: 'modal'
                  }} 
                />
                <Stack.Screen 
                  name="settings/index" 
                  options={{ 
                    title: 'Settings'
                  }} 
                />
                <Stack.Screen 
                  name="settings/security" 
                  options={{ 
                    title: 'Security'
                  }} 
                />
              </Stack>
              <Toast />
            </NotificationProvider>
          </AuthProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}