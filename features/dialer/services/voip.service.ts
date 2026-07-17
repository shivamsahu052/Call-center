import * as Linking from 'expo-linking';

import { apiService } from '@/features/dialer/services/api.service';
import type { ActiveCallState, CallControls, CallRecord, PlaceCallPayload } from '@/types';

/**
 * Telephony provider abstraction layer.
 * The API owns call state. EXPO_PUBLIC_CALL_MODE=system additionally hands the
 * number to the device phone app; in-app audio can replace this adapter later.
 */
export interface VoipServiceInterface {
  initialize(): Promise<void>;
  placeCall(payload: PlaceCallPayload, callId?: string): Promise<ActiveCallState>;
  answerCall(callId: string): Promise<void>;
  endCall(callId: string): Promise<CallRecord>;
  toggleMute(callId: string, muted: boolean): Promise<void>;
  toggleSpeaker(callId: string, enabled: boolean): Promise<void>;
  toggleHold(callId: string, onHold: boolean): Promise<void>;
  sendDtmf(callId: string, digit: string): Promise<void>;
  transferCall(callId: string, targetNumber: string): Promise<void>;
  destroy(): Promise<void>;
}

class BackendVoipService implements VoipServiceInterface {
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async placeCall(payload: PlaceCallPayload, callId?: string): Promise<ActiveCallState> {
    const call = await apiService.startCall(payload, callId);

    if (process.env.EXPO_PUBLIC_CALL_MODE === 'system') {
      const callableNumber = payload.phoneNumber.replace(/[^\d+]/g, '');
      await Linking.openURL(`tel:${callableNumber}`);
    }

    return call;
  }

  async answerCall(_callId: string): Promise<void> {
    throw new Error('Incoming call answering requires a telephony provider adapter');
  }

  async endCall(callId: string): Promise<CallRecord> {
    return apiService.endCall(callId);
  }

  async toggleMute(callId: string, muted: boolean): Promise<void> {
    await apiService.updateControls(callId, { isMuted: muted });
  }

  async toggleSpeaker(callId: string, enabled: boolean): Promise<void> {
    await apiService.updateControls(callId, { isSpeakerOn: enabled });
  }

  async toggleHold(callId: string, onHold: boolean): Promise<void> {
    await apiService.updateControls(callId, { isOnHold: onHold });
  }

  async sendDtmf(callId: string, digit: string): Promise<void> {
    await apiService.sendDtmf(callId, digit);
  }

  async transferCall(_callId: string, _targetNumber: string): Promise<void> {
    throw new Error('Call transfer requires a telephony provider adapter');
  }

  async destroy(): Promise<void> {
    return Promise.resolve();
  }
}

export const voipService: VoipServiceInterface = new BackendVoipService();

export async function applyCallControls(
  callId: string,
  controls: Partial<CallControls>,
): Promise<void> {
  if (controls.isMuted !== undefined) {
    await voipService.toggleMute(callId, controls.isMuted);
  }
  if (controls.isSpeakerOn !== undefined) {
    await voipService.toggleSpeaker(callId, controls.isSpeakerOn);
  }
  if (controls.isOnHold !== undefined) {
    await voipService.toggleHold(callId, controls.isOnHold);
  }
}
