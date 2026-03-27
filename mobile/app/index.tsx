import React, { useEffect, useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Dimensions,
  Animated,
  StatusBar
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

const { width, height } = Dimensions.get('window')

export default function SplashScreen() {
  const [fadeAnim] = useState(new Animated.Value(0))
  const [scaleAnim] = useState(new Animated.Value(0.8))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    // Animate logo entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()

    try {
      // Check for biometric authentication
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync()
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      
      if (hasHardware && biometricTypes.length > 0) {
        await SecureStore.setItemAsync('biometric_available', 'true')
      }

      // Check for stored wallet
      const storedWallet = await SecureStore.getItemAsync('user_wallet')
      const biometricEnabled = await SecureStore.getItemAsync('biometric_enabled')
      
      // Simulate loading time
      setTimeout(() => {
        setIsLoading(false)
        
        if (storedWallet && biometricEnabled === 'true') {
          // Authenticate with biometrics
          authenticateWithBiometrics()
        } else if (storedWallet) {
          // Go to main app
          router.replace('/(tabs)')
        } else {
          // Go to authentication
          router.replace('/auth/login')
        }
      }, 2000)

    } catch (error) {
      console.error('Initialization error:', error)
      setTimeout(() => {
        router.replace('/auth/login')
      }, 2000)
    }
  }

  const authenticateWithBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your sBTC Options',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel'
      })

      if (result.success) {
        router.replace('/(tabs)')
      } else {
        router.replace('/auth/login')
      }
    } catch (error) {
      console.error('Biometric authentication error:', error)
      router.replace('/auth/login')
    }
  }

  return (
    <LinearGradient
      colors={['#F97316', '#EA580C', '#DC2626']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>₿</Text>
        </View>
        
        <Text style={styles.title}>sBTC Options</Text>
        <Text style={styles.subtitle}>Advanced Bitcoin Options Trading</Text>
      </Animated.View>

      <Animated.View 
        style={[
          styles.bottomContainer,
          { opacity: fadeAnim }
        ]}
      >
        {isLoading && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDot} />
            <View style={[styles.loadingDot, { animationDelay: 200 }]} />
            <View style={[styles.loadingDot, { animationDelay: 400 }]} />
          </View>
        )}
        
        <Text style={styles.version}>v1.0.0</Text>
        <Text style={styles.poweredBy}>Powered by Stacks & Lightning Network</Text>
      </Animated.View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconText: {
    fontSize: 48,
    color: '#FFF',
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold'
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter-Bold'
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontFamily: 'Inter-Regular'
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginHorizontal: 4,
    opacity: 0.6,
  },
  version: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontFamily: 'Inter-Medium'
  },
  poweredBy: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontFamily: 'Inter-Regular'
  },
})