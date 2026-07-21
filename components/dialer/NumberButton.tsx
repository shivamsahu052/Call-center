import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { DIALER_FONT_FAMILY } from '@/constants';
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

  const buttonSize = size === 'default' ? 68 : 56;
  const digitFontSize = size === 'default' ? 30 : 26;
  const digitLineHeight = size === 'default' ? 34 : 30;
  const lettersFontSize = size === 'default' ? 10 : 9;
  const lettersLineHeight = size === 'default' ? 13 : 11;

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
        className="items-center justify-center rounded-full bg-dialer-surface dark:bg-dialer-surface-dark"
        style={{ height: buttonSize, width: buttonSize }}
      >
        <Text
          className="font-normal text-dialer-text dark:text-dialer-text-dark"
          maxFontSizeMultiplier={1.05}
          style={{
            fontFamily: DIALER_FONT_FAMILY,
            fontSize: digitFontSize,
            lineHeight: digitLineHeight,
          }}
        >
          {digit}
        </Text>
        {letters ? (
          <Text
            className="font-medium text-dialer-muted dark:text-dialer-muted-dark"
            maxFontSizeMultiplier={1.05}
            style={{
              fontFamily: DIALER_FONT_FAMILY,
              fontSize: lettersFontSize,
              lineHeight: lettersLineHeight,
            }}
          >
            {letters}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
