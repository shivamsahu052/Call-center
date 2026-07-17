import { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { cn } from '@/features/dialer/utils/formatters';

interface TabBarItem<T extends string> {
  key: T;
  label: string;
  badge?: number;
}

interface TabBarProps<T extends string> {
  tabs: TabBarItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
}

export function TabBar<T extends string>({ tabs, activeTab, onTabChange, className }: TabBarProps<T>) {
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorPosition = useSharedValue(0);

  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width / tabs.length;
    setTabWidth(width);
    indicatorPosition.value = withSpring(activeIndex * width, { damping: 20, stiffness: 300 });
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
    width: tabWidth,
  }));

  const handleTabPress = (tab: T, index: number) => {
    onTabChange(tab);
    indicatorPosition.value = withSpring(index * tabWidth, { damping: 20, stiffness: 300 });
  };

  return (
    <View
      className={cn('border-b border-dialer-border dark:border-dialer-border-dark', className)}
      onLayout={handleLayout}
    >
      <View className="flex-row">
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab.key, index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              className="flex-1 flex-row items-center justify-center py-3"
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  isActive
                    ? 'text-dialer-primary'
                    : 'text-dialer-muted dark:text-dialer-muted-dark',
                )}
              >
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 ? (
                <View className="ml-1.5 min-w-[18px] items-center rounded-full bg-dialer-end px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold text-white">{tab.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {tabWidth > 0 ? (
        <Animated.View style={indicatorStyle} className="absolute bottom-0 h-0.5 bg-dialer-primary" />
      ) : null}
    </View>
  );
}
