import { Phone, Clock } from 'lucide-react-native';
import { Tabs } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { DIALER_FONT_FAMILY } from '@/constants';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A73E8',
        tabBarInactiveTintColor: isDark ? '#9AA0A6' : '#5F6368',
        tabBarStyle: {
          backgroundColor: isDark ? '#121212' : '#FFFFFF',
          borderTopColor: isDark ? '#3C4043' : '#DADCE0',
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: DIALER_FONT_FAMILY,
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0,
          lineHeight: 15,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Keypad',
          tabBarIcon: ({ color, size }) => (
            <Phone size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Recents',
          tabBarIcon: ({ color, size }) => (
            <Clock size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
