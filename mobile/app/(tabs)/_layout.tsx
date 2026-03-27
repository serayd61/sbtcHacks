import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          fontFamily: 'Inter-Medium'
        },
        headerStyle: {
          backgroundColor: '#F97316',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#FFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontFamily: 'Inter-Bold'
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Portfolio',
          headerTitle: 'My Portfolio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pie-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          headerTitle: 'sBTC Vault',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="vault" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="options"
        options={{
          title: 'Options',
          headerTitle: 'Options Market',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="farming"
        options={{
          title: 'Farming',
          headerTitle: 'Yield Farming',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}