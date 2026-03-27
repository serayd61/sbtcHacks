import React from 'react'
import { View, ViewStyle, StyleSheet } from 'react-native'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
}

export function Card({ children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
})