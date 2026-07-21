import { User } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { DIALER_FONT_FAMILY } from '@/constants';
import type { ActiveCallState } from '@/types';
import {
  formatPhoneNumber,
  getCallStatusLabel,
  cn,
} from '@/features/dialer/utils/formatters';
import { CallTimer } from '@/components/dialer/CallTimer';

interface CallCardProps {
  call: ActiveCallState;
  className?: string;
}

export function CallCard({ call, className }: CallCardProps) {
  const isConnected = call.status === 'connected' || call.status === 'on-hold';
  const displayNumber = formatPhoneNumber(call.phoneNumber) || call.phoneNumber;

  return (
    <View className={cn('items-center px-6', className)}>
      <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-dialer-surface dark:bg-dialer-surface-dark">
        <User size={40} color="#5F6368" strokeWidth={1.5} />
      </View>

      {call.contactName ? (
        <Text
          className="mb-1 text-2xl font-normal text-dialer-text dark:text-dialer-text-dark"
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 32 }}
        >
          {call.contactName}
        </Text>
      ) : null}

      <Text
        adjustsFontSizeToFit
        className={cn(
          'w-full text-center font-light text-dialer-text dark:text-dialer-text-dark',
          call.contactName ? 'text-lg' : 'text-3xl',
        )}
        maxFontSizeMultiplier={1.05}
        minimumFontScale={0.65}
        numberOfLines={1}
        style={{
          fontFamily: DIALER_FONT_FAMILY,
          lineHeight: call.contactName ? 26 : 38,
        }}
      >
        {displayNumber}
      </Text>

      <Text
        className="mt-3 text-base text-dialer-muted dark:text-dialer-muted-dark"
        maxFontSizeMultiplier={1.1}
        style={{ fontFamily: DIALER_FONT_FAMILY, lineHeight: 22 }}
      >
        {getCallStatusLabel(call.status)}
        {call.isOnHold ? ' - On Hold' : ''}
      </Text>

      {isConnected ? (
        <View className="mt-4">
          <CallTimer
            startedAt={call.connectedAt ?? call.startedAt}
            isRunning={!call.isOnHold}
          />
        </View>
      ) : null}
    </View>
  );
}
