import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { DIALER_FONT_FAMILY } from '@/constants';
import { cn } from '@/features/dialer/utils/formatters';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DialButtonProps {
  label?: string;
  icon?: LucideIcon;
  onPress: () => void;
  variant?: 'default' | 'call' | 'end' | 'ghost';
  size?: 'default' | 'large' | 'small';
  active?: boolean;
  disabled?: boolean;
  className?: string;
  iconColor?: string;
}

export function DialButton({
  label,
  icon: Icon,
  onPress,
  variant = 'default',
  size = 'default',
  active = false,
  disabled = false,
  className,
  iconColor,
}: DialButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const sizeClasses = {
    small: 'h-12 w-12',
    default: 'h-16 w-16',
    large: 'h-[72px] w-[72px]',
  };

  const variantClasses = {
    default: active
      ? 'bg-dialer-primary'
      : 'bg-dialer-surface dark:bg-dialer-surface-dark',
    call: 'bg-dialer-call',
    end: 'bg-dialer-end',
    ghost: 'bg-transparent',
  };

  const iconSize = size === 'large' ? 32 : size === 'small' ? 20 : 24;
  const defaultIconColor =
    variant === 'call' || variant === 'end' || active ? '#FFFFFF' : undefined;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('items-center', className)}
    >
      <View
        className={cn(
          sizeClasses[size],
          'items-center justify-center rounded-full',
          variantClasses[variant],
        )}
      >
        {Icon ? (
          <Icon
            size={iconSize}
            color={
              iconColor ?? defaultIconColor ?? (active ? '#FFFFFF' : '#5F6368')
            }
            strokeWidth={2}
          />
        ) : null}
      </View>
      {label ? (
        <Text
          className="mt-2 text-xs font-medium text-dialer-muted dark:text-dialer-muted-dark"
          maxFontSizeMultiplier={1.1}
          numberOfLines={1}
          style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 16 }}
        >
          {label}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}
