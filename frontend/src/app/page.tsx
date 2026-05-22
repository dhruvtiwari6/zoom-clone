'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ActionCards from '@/components/ActionCards';
import DateTimeCard from '@/components/DateTimeCard';
import MeetingList from '@/components/MeetingList';
import JoinModal from '@/components/JoinModal';
import ScheduleModal from '@/components/ScheduleModal';
import { api } from '@/lib/api';
import type { Meeting } from '@/types';

export default function Dashboard() {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [showJoin, setShowJoin] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    try {
      const data = await api.listMeetings();
      setUpcoming(data.upcoming);
      setRecent(data.recent);
    } catch {
      // Fallback sample data if API not available
      setUpcoming([
        { id: 1, meeting_id: '940-5050-6425', title: 'My Meeting', description: 'Quarterly sprint planning', host_id: 1, status: 'scheduled', scheduled_at: new Date().toISOString(), duration_minutes: 40, invite_link: '/meeting/940-5050-6425', passcode: 'abc123', created_at: new Date().toISOString(), ended_at: null, host: null, participants: [] }
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleNewMeeting = async () => {
    try {
      const meeting = await api.createMeeting({ title: 'My Meeting' });
      sessionStorage.setItem(`host_of_${meeting.meeting_id}`, 'true');
      router.push(`/meeting/${meeting.meeting_id}`);
    } catch {
      const id = '940-5050-6425';
      sessionStorage.setItem(`host_of_${id}`, 'true');
      router.push(`/meeting/${id}`);
    }
  };

  const handleJoin = async (meetingId: string, displayName: string) => {
    try {
      await api.getMeeting(meetingId);
      await api.joinMeeting(meetingId, { display_name: displayName });
    } catch {}
    setShowJoin(false);
    router.push(`/meeting/${meetingId}?name=${encodeURIComponent(displayName)}`);
  };

  const handleSchedule = async (data: { title: string; description: string; scheduled_at: string; duration_minutes: number }) => {
    try {
      await api.scheduleMeeting(data);
      await fetchMeetings();
    } catch {}
    setShowSchedule(false);
  };

  return (
    <div className="workplace-dashboard">
      <div className="workplace-dashboard-content">
        
        {/* Giant Minimalist Clock Widget */}
        <DateTimeCard />

        {/* Circular Action Buttons Row */}
        <ActionCards 
          onNewMeeting={handleNewMeeting} 
          onJoinMeeting={() => setShowJoin(true)} 
          onSchedule={() => setShowSchedule(true)} 
        />

        {/* Blue Info calendar banner */}
        <div className="calendar-notice-banner">
          <span className="material-symbols-outlined notice-icon">info</span>
          <span className="notice-text">
            You haven't connected your calendar yet. <span className="connect-link">Connect now</span> to manage all your meetings and events in one place.
          </span>
        </div>

        {/* Unified workplace meetings card */}
        {loading ? (
          <div className="empty-state"><p>Loading meetings...</p></div>
        ) : (
          <MeetingList upcoming={upcoming} recent={recent} onRefresh={fetchMeetings} />
        )}
      </div>

      <JoinModal isOpen={showJoin} onClose={() => setShowJoin(false)} onJoin={handleJoin} />
      <ScheduleModal isOpen={showSchedule} onClose={() => setShowSchedule(false)} onSchedule={handleSchedule} />
    </div>
  );
}
