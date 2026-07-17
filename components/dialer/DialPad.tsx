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

export function DialPad({ onDigitPress, onDigitLongPress, size = 'default', className }: DialPadProps) {
  return (
    <View className={cn('w-full max-w-sm self-center', className)}>
      {DIAL_PAD_KEYS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} className="mb-4 flex-row justify-around">
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
