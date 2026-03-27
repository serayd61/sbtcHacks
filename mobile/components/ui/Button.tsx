import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

interface ButtonProps {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'small' | 'medium' | 'large'
  style?: ViewStyle | ViewStyle[]
  textStyle?: TextStyle | TextStyle[]
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle
}: ButtonProps) {
  const isDisabled = disabled || loading

  const getButtonHeight = () => {
    switch (size) {
      case 'small': return 36
      case 'large': return 56
      default: return 48
    }
  }

  const getTextSize = () => {
    switch (size) {
      case 'small': return 14
      case 'large': return 18
      default: return 16
    }
  }

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.button,
          { height: getButtonHeight() },
          isDisabled && styles.disabledButton,
          style
        ]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isDisabled ? ['#9CA3AF', '#9CA3AF'] : ['#F97316', '#EA580C']}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={[
              styles.primaryText,
              { fontSize: getTextSize() },
              textStyle
            ]}>
              {title}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.button,
          styles.outlineButton,
          { height: getButtonHeight() },
          isDisabled && styles.disabledOutlineButton,
          style
        ]}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color="#F97316" size="small" />
        ) : (
          <Text style={[
            styles.outlineText,
            { fontSize: getTextSize() },
            isDisabled && styles.disabledOutlineText,
            textStyle
          ]}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    )
  }

  // Secondary variant
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        styles.secondaryButton,
        { height: getButtonHeight() },
        isDisabled && styles.disabledSecondaryButton,
        style
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#374151" size="small" />
      ) : (
        <Text style={[
          styles.secondaryText,
          { fontSize: getTextSize() },
          isDisabled && styles.disabledSecondaryText,
          textStyle
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  secondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  outlineText: {
    color: '#F97316',
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledSecondaryButton: {
    backgroundColor: '#E5E7EB',
  },
  disabledSecondaryText: {
    color: '#9CA3AF',
  },
  disabledOutlineButton: {
    borderColor: '#E5E7EB',
  },
  disabledOutlineText: {
    color: '#9CA3AF',
  },
})