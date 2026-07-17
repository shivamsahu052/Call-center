import { useCallback } from 'react';

import { dialerService } from '@/features/dialer/services/dialer.service';
import { useCallStore } from '@/store';

export function useDialer() {
  const dialedNumber = useCallStore((s) => s.dialedNumber);
  const appendDigit = useCallStore((s) => s.appendDigit);
  const backspace = useCallStore((s) => s.backspace);
  const clearDialedNumber = useCallStore((s) => s.clearDialedNumber);
  const selectContact = useCallStore((s) => s.selectContact);
  const placeCall = useCallStore((s) => s.placeCall);
  const isPlacingCall = useCallStore((s) => s.isPlacingCall);
  const recentContacts = useCallStore((s) => s.recentContacts);
  const favoriteContacts = useCallStore((s) => s.favoriteContacts);
  const connectionStatus = useCallStore((s) => s.connectionStatus);
  const connectionError = useCallStore((s) => s.connectionError);
  const initialize = useCallStore((s) => s.initialize);

  const formattedNumber = dialerService.formatDisplay(dialedNumber);
  const canCall =
    dialerService.isValidForCall(dialedNumber) &&
    !isPlacingCall &&
    connectionStatus === 'connected';

  const handleDigitPress = useCallback(
    (digit: string) => {
      appendDigit(digit);
    },
    [appendDigit],
  );

  const handleDigitLongPress = useCallback(
    (digit: string) => {
      if (digit === '0') {
        appendDigit('+');
      }
    },
    [appendDigit],
  );

  return {
    dialedNumber,
    formattedNumber,
    canCall,
    isPlacingCall,
    recentContacts,
    favoriteContacts,
    connectionStatus,
    connectionError,
    retryConnection: initialize,
    handleDigitPress,
    handleDigitLongPress,
    backspace,
    clearDialedNumber,
    selectContact,
    placeCall,
  };
}
