export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Participant {
  id: number;
  meeting_id: number;
  user_id: number | null;
  display_name: string;
  role: 'host' | 'co-host' | 'participant';
  is_muted: boolean;
  is_video_on: boolean;
  joined_at: string | null;
  left_at: string | null;
}

export interface Meeting {
  id: number;
  meeting_id: string;
  title: string;
  description: string | null;
  host_id: number;
  status: 'scheduled' | 'active' | 'ended';
  scheduled_at: string | null;
  duration_minutes: number;
  invite_link: string | null;
  passcode: string;
  created_at: string;
  ended_at: string | null;
  host: User | null;
  participants: Participant[];
}

export interface MeetingListResponse {
  upcoming: Meeting[];
  recent: Meeting[];
}

export interface MeetingCreatePayload {
  title?: string;
  host_id?: number;
}

export interface MeetingSchedulePayload {
  title: string;
  description?: string;
  host_id?: number;
  scheduled_at: string;
  duration_minutes: number;
  passcode?: string;
}

export interface JoinPayload {
  display_name: string;
  user_id?: number;
  passcode?: string;
}

export interface Message {
  id: number;
  meeting_id: number;
  sender_name: string;
  text: string;
  created_at: string;
}
