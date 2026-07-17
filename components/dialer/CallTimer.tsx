import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { formatDuration } from '@/features/dialer/utils/formatters';
import { cn } from '@/features/dialer/utils/formatters';

interface CallTimerProps {
  startedAt?: string;
  isRunning: boolean;
  fallbackSeconds?: number;
  className?: string;
  textClassName?: string;
}

export function CallTimer({
  startedAt,
  isRunning,
  fallbackSeconds = 0,
  className,
  textClassName,
}: CallTimerProps) {
  const [elapsed, setElapsed] = useState(fallbackSeconds);

  useEffect(() => {
    if (!isRunning) {
      setElapsed(fallbackSeconds);
      return;
    }

    const computeElapsed = () => {
      if (startedAt) {
        return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      }
      return fallbackSeconds;
    };

    setElapsed(computeElapsed());

    const interval = setInterval(() => {
      setElapsed(computeElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, isRunning, fallbackSeconds]);

  return (
    <Text
      className={cn(
        'font-mono text-2xl font-light tracking-wider text-dialer-text dark:text-dialer-text-dark',
        className,
        textClassName,
      )}
    >
      {formatDuration(elapsed)}
    </Text>
  );
}
