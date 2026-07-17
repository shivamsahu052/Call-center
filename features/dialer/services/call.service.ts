import type { ActiveCallState, CallRecord, PlaceCallPayload } from '@/types';
import { apiService } from '@/features/dialer/services/api.service';
import { generateCallId } from '@/features/dialer/utils/formatters';
import { voipService } from '@/features/dialer/services/voip.service';

/**
 * Call lifecycle service — orchestrates VoIP provider and local call state.
 * UI layers should call this service, not voipService directly.
 */
export interface CallServiceInterface {
  startOutgoingCall(payload: PlaceCallPayload, callId?: string): Promise<ActiveCallState>;
  endCall(activeCall: ActiveCallState, notes?: string): Promise<CallRecord>;
  updateCallControls(
    callId: string,
    controls: Partial<Pick<ActiveCallState, 'isMuted' | 'isSpeakerOn' | 'isOnHold' | 'isKeypadVisible'>>,
  ): Promise<void>;
  sendDtmf(callId: string, digit: string): Promise<void>;
  transferCall(callId: string, targetNumber: string): Promise<void>;
}

class CallService implements CallServiceInterface {
  async startOutgoingCall(payload: PlaceCallPayload, existingCallId?: string): Promise<ActiveCallState> {
    await voipService.initialize();

    const callId = existingCallId ?? generateCallId('out');
    const startedAt = new Date().toISOString();

    const dialingCall: ActiveCallState = {
      id: callId,
      phoneNumber: payload.phoneNumber,
      contactName: payload.contactName,
      contactId: payload.contactId,
      type: 'outgoing',
      status: 'dialing',
      startedAt,
      isMuted: false,
      isSpeakerOn: false,
      isOnHold: false,
      isKeypadVisible: false,
    };

    await voipService.placeCall(payload, callId);

    return {
      ...dialingCall,
      status: 'connected',
      connectedAt: new Date().toISOString(),
    };
  }

  async endCall(activeCall: ActiveCallState, notes?: string): Promise<CallRecord> {
    const record = await apiService.endCall(activeCall.id, notes);

    return {
      ...record,
      id: activeCall.id,
      phoneNumber: activeCall.phoneNumber,
      contactName: activeCall.contactName,
      contactId: activeCall.contactId,
      type: activeCall.type,
      notes: record.notes ?? notes,
    };
  }

  async updateCallControls(
    callId: string,
    controls: Partial<Pick<ActiveCallState, 'isMuted' | 'isSpeakerOn' | 'isOnHold' | 'isKeypadVisible'>>,
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

  async sendDtmf(callId: string, digit: string): Promise<void> {
    await voipService.sendDtmf(callId, digit);
  }

  async transferCall(callId: string, targetNumber: string): Promise<void> {
    await voipService.transferCall(callId, targetNumber);
  }
}

export const callService: CallServiceInterface = new CallService();
