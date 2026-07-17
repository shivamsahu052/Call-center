import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { useCallStore } from '@/store';

export function useActiveCall() {
  const router = useRouter();
  const activeCall = useCallStore((s) => s.activeCall);
  const endActiveCall = useCallStore((s) => s.endActiveCall);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);
  const toggleHold = useCallStore((s) => s.toggleHold);
  const toggleKeypad = useCallStore((s) => s.toggleKeypad);
  const sendDtmf = useCallStore((s) => s.sendDtmf);

  const handleEndCall = useCallback(
    async (notes?: string) => {
      const record = await endActiveCall(notes);
      if (record) {
        router.replace(`/call/${record.id}`);
      } else {
        router.back();
      }
    },
    [endActiveCall, router],
  );

  return {
    activeCall,
    toggleMute,
    toggleSpeaker,
    toggleHold,
    toggleKeypad,
    sendDtmf,
    handleEndCall,
  };
}
