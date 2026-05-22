const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

// ─── Meetings ────────────────────────────────────────────────

import type {
  Meeting,
  MeetingListResponse,
  MeetingCreatePayload,
  MeetingSchedulePayload,
  JoinPayload,
  Participant,
  Message,
} from '@/types';

export const api = {
  // List all meetings (upcoming + recent)
  listMeetings: (hostId = 1) =>
    request<MeetingListResponse>(`/api/meetings?host_id=${hostId}`),

  // Create instant meeting
  createMeeting: (data: MeetingCreatePayload = {}) =>
    request<Meeting>('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({ title: data.title || 'Zoom Meeting', host_id: data.host_id || 1 }),
    }),

  // Schedule a meeting
  scheduleMeeting: (data: MeetingSchedulePayload) =>
    request<Meeting>('/api/meetings/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...data, host_id: data.host_id || 1 }),
    }),

  // Get meeting by meeting ID
  getMeeting: (meetingId: string) =>
    request<Meeting>(`/api/meetings/${meetingId}`),

  // Update meeting
  updateMeeting: (meetingId: string, data: Record<string, unknown>) =>
    request<Meeting>(`/api/meetings/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Delete meeting
  deleteMeeting: (meetingId: string) =>
    request<void>(`/api/meetings/${meetingId}`, { method: 'DELETE' }),

  // Join meeting
  joinMeeting: (meetingId: string, data: JoinPayload) =>
    request<Participant>(`/api/meetings/${meetingId}/join`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // List participants
  listParticipants: (meetingId: string) =>
    request<Participant[]>(`/api/meetings/${meetingId}/participants`),

  // Update participant
  updateParticipant: (participantId: number, data: Record<string, unknown>) =>
    request<Participant>(`/api/participants/${participantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Remove participant
  removeParticipant: (participantId: number) =>
    request<void>(`/api/participants/${participantId}`, { method: 'DELETE' }),

  // Mute all
  muteAll: (meetingId: string) =>
    request<{ message: string }>(`/api/meetings/${meetingId}/mute-all`, { method: 'POST' }),

  // List chat messages
  listMessages: (meetingId: string) =>
    request<Message[]>(`/api/meetings/${meetingId}/messages`),

  // Send a chat message
  sendMessage: (meetingId: string, data: { sender_name: string; text: string }) =>
    request<Message>(`/api/meetings/${meetingId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Send emoji reaction
  sendReaction: (meetingId: string, data: { emoji: string; sender_name: string }) =>
    request<{ ok: boolean }>(`/api/meetings/${meetingId}/react`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get LiveKit access token
  getJoinToken: (meetingId: string, identity: string, name: string) =>
    request<{ token: string; server_url: string }>(
      `/api/meetings/${meetingId}/token?participant_identity=${encodeURIComponent(identity)}&participant_name=${encodeURIComponent(name)}`,
      { method: 'POST' }
    ),
};
