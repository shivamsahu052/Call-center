import { View } from 'react-native';

import { DIAL_PAD_KEYS } from '@/constants';
import { NumberButton } from '@/components/dialer/NumberButton';
import { cn } from '@/features/dialer/utils/formatters';

interface DialPadProps {
  onDigitPress: (digit: string) => void;
  onDigitLongPress?: (digit: string) => void;
  size?: 'default' | 'compact';
  className?: string;
}

export function DialPad({
  onDigitPress,
  onDigitLongPress,
  size = 'default',
  className,
}: DialPadProps) {
  const rowGap = size === 'compact' ? 8 : 12;

  return (
    <View
      className={cn('w-full max-w-[340px] self-center', className)}
      style={{ rowGap }}
    >
      {DIAL_PAD_KEYS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} className="flex-row justify-around">
          {row.map((key) => (
            <NumberButton
              key={key.digit}
              digit={key.digit}
              letters={key.letters}
              onPress={onDigitPress}
              onLongPress={onDigitLongPress}
              size={size}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
