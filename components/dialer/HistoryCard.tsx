import { ArrowDownLeft, ArrowUpRight, PhoneMissed } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { CallRecord } from '@/types';
import { formatCallTime, formatDuration, cn } from '@/features/dialer/utils/formatters';

interface HistoryCardProps {
  call: CallRecord;
  onPress: (call: CallRecord) => void;
}

function CallTypeIcon({ type }: { type: CallRecord['type'] }) {
  const iconProps = { size: 16, strokeWidth: 2.5 };

  switch (type) {
    case 'incoming':
      return <ArrowDownLeft {...iconProps} color="#34A853" />;
    case 'outgoing':
      return <ArrowUpRight {...iconProps} color="#1A73E8" />;
    case 'missed':
      return <PhoneMissed {...iconProps} color="#EA4335" />;
    default:
      return null;
  }
}

export function HistoryCard({ call, onPress }: HistoryCardProps) {
  const displayName = call.contactName ?? call.phoneNumber;
  const isMissed = call.type === 'missed';

  return (
    <Pressable
      onPress={() => onPress(call)}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${call.type} call`}
      className="flex-row items-center px-4 py-3.5 active:bg-dialer-surface dark:active:bg-dialer-surface-dark"
    >
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-dialer-surface dark:bg-dialer-surface-dark">
        <CallTypeIcon type={call.type} />
      </View>

      <View className="flex-1">
        <Text
          className={cn(
            'text-base font-medium',
            isMissed
              ? 'text-dialer-end'
              : 'text-dialer-text dark:text-dialer-text-dark',
          )}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {call.contactName ? (
          <Text className="text-sm text-dialer-muted dark:text-dialer-muted-dark" numberOfLines={1}>
            {call.phoneNumber}
          </Text>
        ) : null}
      </View>

      <View className="items-end">
        <Text className="text-xs text-dialer-muted dark:text-dialer-muted-dark">
          {formatCallTime(call.startedAt)}
        </Text>
        {call.duration > 0 ? (
          <Text className="mt-0.5 text-xs text-dialer-muted dark:text-dialer-muted-dark">
            {formatDuration(call.duration)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
