import { Platform } from 'react-native';

import type { ActiveCallState, CallRecord, Contact, PlaceCallPayload } from '@/types';

export interface BootstrapResponse {
  contacts: Contact[];
  calls: CallRecord[];
  activeCalls: ActiveCallState[];
}

const defaultApiUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/+$/, '');

class ApiService {
  async getBootstrap(): Promise<BootstrapResponse> {
    return this.request<BootstrapResponse>('/api/bootstrap');
  }

  async startCall(
    payload: PlaceCallPayload,
    callId?: string,
  ): Promise<ActiveCallState> {
    return this.request<ActiveCallState>('/api/calls', {
      method: 'POST',
      body: JSON.stringify({ ...payload, callId }),
    });
  }

  async updateControls(
    callId: string,
    controls: Partial<
      Pick<ActiveCallState, 'isMuted' | 'isSpeakerOn' | 'isOnHold'>
    >,
  ): Promise<ActiveCallState> {
    return this.request<ActiveCallState>(
      `/api/calls/${encodeURIComponent(callId)}/controls`,
      {
        method: 'PATCH',
        body: JSON.stringify(controls),
      },
    );
  }

  async sendDtmf(callId: string, digit: string): Promise<void> {
    await this.request(`/api/calls/${encodeURIComponent(callId)}/dtmf`, {
      method: 'POST',
      body: JSON.stringify({ digit }),
    });
  }

  async endCall(callId: string, notes?: string): Promise<CallRecord> {
    return this.request<CallRecord>(
      `/api/calls/${encodeURIComponent(callId)}/end`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      },
    );
  }

  async updateNotes(callId: string, notes: string): Promise<CallRecord> {
    return this.request<CallRecord>(`/api/calls/${encodeURIComponent(callId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | T
      | null;

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? body.error
          : undefined;
      throw new Error(message || `Server request failed (${response.status})`);
    }

    return body as T;
  }
}

export const apiService = new ApiService();
export const dialerApiUrl = apiUrl;
