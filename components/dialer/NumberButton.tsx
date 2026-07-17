import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { cn } from '@/features/dialer/utils/formatters';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface NumberButtonProps {
  digit: string;
  letters?: string;
  onPress: (digit: string) => void;
  onLongPress?: (digit: string) => void;
  size?: 'default' | 'compact';
  className?: string;
}

export function NumberButton({
  digit,
  letters,
  onPress,
  onLongPress,
  size = 'default',
  className,
}: NumberButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const buttonSize = size === 'default' ? 'h-[72px] w-[72px]' : 'h-14 w-14';

  return (
    <AnimatedPressable
      onPress={() => onPress(digit)}
      onLongPress={onLongPress ? () => onLongPress(digit) : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={`Dial ${digit}${letters ? `, ${letters}` : ''}`}
      className={cn('items-center justify-center', className)}
    >
      <View
        className={cn(
          buttonSize,
          'items-center justify-center rounded-full bg-dialer-surface dark:bg-dialer-surface-dark',
        )}
      >
        <Text className="text-3xl font-normal text-dialer-text dark:text-dialer-text-dark">{digit}</Text>
        {letters ? (
          <Text className="-mt-0.5 text-[10px] font-medium tracking-widest text-dialer-muted dark:text-dialer-muted-dark">
            {letters}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
