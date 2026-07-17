import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/features/dialer/utils/formatters';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: LucideIcon;
  rightAction?: {
    icon: LucideIcon;
    onPress: () => void;
    label?: string;
  };
  transparent?: boolean;
  className?: string;
}

export function Header({
  title,
  subtitle,
  onBack,
  backIcon: BackIcon,
  rightAction,
  transparent = false,
  className,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn(
        'px-4 pb-3',
        transparent ? 'bg-transparent' : 'bg-dialer-bg dark:bg-dialer-bg-dark',
        className,
      )}
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="min-h-[44px] flex-row items-center justify-between">
        <View className="w-12">
          {onBack && BackIcon ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-dialer-surface dark:active:bg-dialer-surface-dark"
            >
              <BackIcon size={24} className="text-dialer-text dark:text-dialer-text-dark" color="#5F6368" />
            </Pressable>
          ) : null}
        </View>

        <View className="flex-1 items-center">
          <Text
            className="text-lg font-semibold text-dialer-text dark:text-dialer-text-dark"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 text-sm text-dialer-muted dark:text-dialer-muted-dark" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="w-12 items-end">
          {rightAction ? (
            <Pressable
              onPress={rightAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label ?? 'Action'}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-dialer-surface dark:active:bg-dialer-surface-dark"
            >
              <rightAction.icon size={22} color="#5F6368" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
