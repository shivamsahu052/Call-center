import { useMemo, useState } from 'react';

import { CALL_HISTORY_TABS } from '@/constants';
import { useCallStore } from '@/store';
import type { CallRecord, CallType } from '@/types';

export function useCallHistory() {
  const [activeTab, setActiveTab] = useState<CallType>('incoming');
  const incomingCalls = useCallStore((s) => s.incomingCalls);
  const outgoingCalls = useCallStore((s) => s.outgoingCalls);
  const missedCalls = useCallStore((s) => s.missedCalls);
  const connectionStatus = useCallStore((s) => s.connectionStatus);
  const refresh = useCallStore((s) => s.initialize);

  const callsByTab = useMemo(
    () => ({
      incoming: incomingCalls,
      outgoing: outgoingCalls,
      missed: missedCalls,
    }),
    [incomingCalls, outgoingCalls, missedCalls],
  );

  const activeCalls = callsByTab[activeTab];

  const tabs = CALL_HISTORY_TABS.map((tab) => ({
    ...tab,
    badge: tab.key === 'missed' ? missedCalls.length : undefined,
  }));

  return {
    activeTab,
    setActiveTab,
    activeCalls,
    tabs,
    isRefreshing: connectionStatus === 'connecting',
    refresh,
  };
}

export function useCallDetails(callId: string) {
  const getCallById = useCallStore((s) => s.getCallById);
  const updateCallNotes = useCallStore((s) => s.updateCallNotes);

  const call: CallRecord | undefined = getCallById(callId);

  return {
    call,
    updateCallNotes: (notes: string) => updateCallNotes(callId, notes),
  };
}
