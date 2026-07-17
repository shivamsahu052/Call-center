import { create } from 'zustand';

import { apiService } from '@/features/dialer/services/api.service';
import { callService } from '@/features/dialer/services/call.service';
import { dialerService } from '@/features/dialer/services/dialer.service';
import { findContactByNumber, generateCallId } from '@/features/dialer/utils/formatters';
import type { ActiveCallState, CallRecord, Contact, PlaceCallPayload } from '@/types';

interface CallStoreState {
  dialedNumber: string;
  incomingCalls: CallRecord[];
  outgoingCalls: CallRecord[];
  missedCalls: CallRecord[];
  callHistory: CallRecord[];
  activeCall: ActiveCallState | null;
  contacts: Contact[];
  recentContacts: Contact[];
  favoriteContacts: Contact[];
  isPlacingCall: boolean;
  connectionStatus: 'connecting' | 'connected' | 'error';
  connectionError: string | null;

  initialize: () => Promise<void>;
  setDialedNumber: (number: string) => void;
  appendDigit: (digit: string) => void;
  backspace: () => void;
  clearDialedNumber: () => void;
  selectContact: (contact: Contact) => void;

  placeCall: () => Promise<ActiveCallState | null>;
  endActiveCall: (notes?: string) => Promise<CallRecord | null>;
  updateActiveCall: (updates: Partial<ActiveCallState>) => void;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  toggleHold: () => Promise<void>;
  toggleKeypad: () => void;
  sendDtmf: (digit: string) => Promise<void>;

  getCallById: (id: string) => CallRecord | undefined;
  updateCallNotes: (id: string, notes: string) => Promise<void>;
}

export const useCallStore = create<CallStoreState>((set, get) => ({
  dialedNumber: '',
  incomingCalls: [],
  outgoingCalls: [],
  missedCalls: [],
  callHistory: [],
  activeCall: null,
  contacts: [],
  recentContacts: [],
  favoriteContacts: [],
  isPlacingCall: false,
  connectionStatus: 'connecting',
  connectionError: null,

  initialize: async () => {
    set({ connectionStatus: 'connecting', connectionError: null });

    try {
      const bootstrap = await apiService.getBootstrap();
      const incomingCalls = bootstrap.calls.filter((call) => call.type === 'incoming');
      const outgoingCalls = bootstrap.calls.filter((call) => call.type === 'outgoing');
      const missedCalls = bootstrap.calls.filter((call) => call.type === 'missed');
      const recentContactIds = new Set(
        bootstrap.calls.map((call) => call.contactId).filter(Boolean),
      );
      const recentContacts = bootstrap.contacts
        .filter((contact) => recentContactIds.has(contact.id))
        .slice(0, 5);

      set({
        contacts: bootstrap.contacts,
        recentContacts:
          recentContacts.length > 0 ? recentContacts : bootstrap.contacts.slice(0, 3),
        favoriteContacts: bootstrap.contacts.filter((contact) => contact.isFavorite),
        incomingCalls,
        outgoingCalls,
        missedCalls,
        callHistory: bootstrap.calls,
        connectionStatus: 'connected',
        connectionError: null,
      });
    } catch (error) {
      set({
        connectionStatus: 'error',
        connectionError:
          error instanceof Error ? error.message : 'Unable to connect to the server',
      });
    }
  },

  setDialedNumber: (number) => set({ dialedNumber: dialerService.sanitize(number) }),

  appendDigit: (digit) =>
    set((state) => ({
      dialedNumber: dialerService.appendDigit(state.dialedNumber, digit),
    })),

  backspace: () =>
    set((state) => ({
      dialedNumber: dialerService.removeLastDigit(state.dialedNumber),
    })),

  clearDialedNumber: () => set({ dialedNumber: '' }),

  selectContact: (contact) => set({ dialedNumber: dialerService.sanitize(contact.phoneNumber) }),

  placeCall: async () => {
    const { dialedNumber, contacts, isPlacingCall } = get();

    if (isPlacingCall || !dialerService.isValidForCall(dialedNumber)) {
      return null;
    }

    try {
      const matchedContact = findContactByNumber(dialedNumber, contacts);
      const payload: PlaceCallPayload = {
        phoneNumber: dialedNumber,
        contactId: matchedContact?.id,
        contactName: matchedContact?.name,
      };

      set({ isPlacingCall: true, dialedNumber: '' });

      const dialingCall: ActiveCallState = {
        id: generateCallId('out'),
        phoneNumber: dialedNumber,
        contactName: matchedContact?.name,
        contactId: matchedContact?.id,
        type: 'outgoing',
        status: 'dialing',
        startedAt: new Date().toISOString(),
        isMuted: false,
        isSpeakerOn: false,
        isOnHold: false,
        isKeypadVisible: false,
      };

      set({ activeCall: dialingCall });

      const connectedCall = await callService.startOutgoingCall(payload, dialingCall.id);
      set({
        activeCall: connectedCall,
        isPlacingCall: false,
        connectionStatus: 'connected',
        connectionError: null,
      });

      return connectedCall;
    } catch (error) {
      set({
        activeCall: null,
        isPlacingCall: false,
        connectionStatus: 'error',
        connectionError: error instanceof Error ? error.message : 'Unable to place call',
      });
      return null;
    }
  },

  endActiveCall: async (notes) => {
    const { activeCall } = get();
    if (!activeCall) return null;

    const record = await callService.endCall(activeCall, notes);

    set((state) => {
      const outgoingCalls = [record, ...state.outgoingCalls];
      const callHistory = [record, ...state.callHistory];

      return {
        activeCall: null,
        outgoingCalls,
        callHistory,
      };
    });

    return record;
  },

  updateActiveCall: (updates) =>
    set((state) => ({
      activeCall: state.activeCall ? { ...state.activeCall, ...updates } : null,
    })),

  toggleMute: async () => {
    const { activeCall, updateActiveCall } = get();
    if (!activeCall) return;

    const isMuted = !activeCall.isMuted;
    updateActiveCall({ isMuted });
    await callService.updateCallControls(activeCall.id, { isMuted });
  },

  toggleSpeaker: async () => {
    const { activeCall, updateActiveCall } = get();
    if (!activeCall) return;

    const isSpeakerOn = !activeCall.isSpeakerOn;
    updateActiveCall({ isSpeakerOn });
    await callService.updateCallControls(activeCall.id, { isSpeakerOn });
  },

  toggleHold: async () => {
    const { activeCall, updateActiveCall } = get();
    if (!activeCall) return;

    const isOnHold = !activeCall.isOnHold;
    updateActiveCall({
      isOnHold,
      status: isOnHold ? 'on-hold' : 'connected',
    });
    await callService.updateCallControls(activeCall.id, { isOnHold });
  },

  toggleKeypad: () => {
    const { activeCall, updateActiveCall } = get();
    if (!activeCall) return;
    updateActiveCall({ isKeypadVisible: !activeCall.isKeypadVisible });
  },

  sendDtmf: async (digit) => {
    const { activeCall } = get();
    if (!activeCall) return;
    await callService.sendDtmf(activeCall.id, digit);
  },

  getCallById: (id) => get().callHistory.find((call) => call.id === id),

  updateCallNotes: async (id, notes) => {
    const record = await apiService.updateNotes(id, notes);
    set((state) => {
      const updateList = (calls: CallRecord[]) =>
        calls.map((call) => (call.id === id ? record : call));

      return {
        incomingCalls: updateList(state.incomingCalls),
        outgoingCalls: updateList(state.outgoingCalls),
        missedCalls: updateList(state.missedCalls),
        callHistory: updateList(state.callHistory),
      };
    });
  },
}));
