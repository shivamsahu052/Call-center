export type CallType = 'incoming' | 'outgoing' | 'missed';

export type CallStatus =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'on-hold'
  | 'ended'
  | 'failed'
  | 'missed';

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  avatarInitials?: string;
  isFavorite?: boolean;
}

export interface CallRecord {
  id: string;
  phoneNumber: string;
  contactName?: string;
  contactId?: string;
  type: CallType;
  status: CallStatus;
  duration: number;
  startedAt: string;
  endedAt?: string;
  notes?: string;
}

export interface ActiveCallState {
  id: string;
  phoneNumber: string;
  contactName?: string;
  contactId?: string;
  type: CallType;
  status: CallStatus;
  startedAt: string;
  connectedAt?: string;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isOnHold: boolean;
  isKeypadVisible: boolean;
}

export interface DialPadKey {
  digit: string;
  letters?: string;
}

export interface CallControls {
  isMuted: boolean;
  isSpeakerOn: boolean;
  isOnHold: boolean;
}

export interface PlaceCallPayload {
  phoneNumber: string;
  contactId?: string;
  contactName?: string;
}

export interface EndCallPayload {
  callId: string;
  duration: number;
  notes?: string;
}
