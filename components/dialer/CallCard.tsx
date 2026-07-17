import { User } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { ActiveCallState } from '@/types';
import { formatPhoneNumber, getCallStatusLabel, cn } from '@/features/dialer/utils/formatters';
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
        <Text className="mb-1 text-2xl font-normal text-dialer-text dark:text-dialer-text-dark">
          {call.contactName}
        </Text>
      ) : null}

      <Text
        className={cn(
          'font-light text-dialer-text dark:text-dialer-text-dark',
          call.contactName ? 'text-lg' : 'text-3xl',
        )}
      >
        {displayNumber}
      </Text>

      <Text className="mt-3 text-base text-dialer-muted dark:text-dialer-muted-dark">
        {getCallStatusLabel(call.status)}
        {call.isOnHold ? ' · On Hold' : ''}
      </Text>

      {isConnected ? (
        <View className="mt-4">
          <CallTimer startedAt={call.connectedAt ?? call.startedAt} isRunning={!call.isOnHold} />
        </View>
      ) : null}
    </View>
  );
}
