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
        { 
          id: 1, 
          meeting_id: '940-5050-6425', 
          title: 'Sprint Planning - Q3 Goals', 
          description: 'Quarterly sprint planning', 
          host_id: 1, 
          status: 'scheduled', 
          scheduled_at: new Date().toISOString(), 
          duration_minutes: 40, 
          invite_link: '/meeting/940-5050-6425', 
          passcode: 'abc123', 
          created_at: new Date().toISOString(), 
          ended_at: null, 
          host: { id: 1, name: 'dhruv tiwari', email: 'dhruv@example.com', avatar_url: null, created_at: '' }, 
          participants: [] 
        },
        { 
          id: 2, 
          meeting_id: '175-1066-3764', 
          title: 'Design Review: Workplace UI', 
          description: 'Workplace design review', 
          host_id: 1, 
          status: 'scheduled', 
          scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), 
          duration_minutes: 60, 
          invite_link: '/meeting/175-1066-3764', 
          passcode: 'abc123', 
          created_at: new Date().toISOString(), 
          ended_at: null, 
          host: { id: 1, name: 'dhruv tiwari', email: 'dhruv@example.com', avatar_url: null, created_at: '' }, 
          participants: [] 
        }
      ]);
      setRecent([
        { 
          id: 3, 
          meeting_id: '826-6302-7753', 
          title: 'WebRTC Connection Sync-Up', 
          description: 'Weekly WebRTC sync', 
          host_id: 1, 
          status: 'ended', 
          scheduled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), 
          duration_minutes: 30, 
          invite_link: '/meeting/826-6302-7753', 
          passcode: 'abc123', 
          created_at: new Date().toISOString(), 
          ended_at: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(), 
          host: { id: 1, name: 'dhruv tiwari', email: 'dhruv@example.com', avatar_url: null, created_at: '' }, 
          participants: [] 
        },
        { 
          id: 4, 
          meeting_id: '492-9405-1940', 
          title: 'Zoom Workplace App Demo', 
          description: 'Final app demo', 
          host_id: 1, 
          status: 'ended', 
          scheduled_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), 
          duration_minutes: 60, 
          invite_link: '/meeting/492-9405-1940', 
          passcode: 'abc123', 
          created_at: new Date().toISOString(), 
          ended_at: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(), 
          host: { id: 1, name: 'dhruv tiwari', email: 'dhruv@example.com', avatar_url: null, created_at: '' }, 
          participants: [] 
        }
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

  const handleJoin = async (meetingId: string, displayName: string, passcode: string) => {
    try {
      await api.getMeeting(meetingId);
      await api.joinMeeting(meetingId, { display_name: displayName, passcode: passcode });
    } catch {}
    setShowJoin(false);
    router.push(`/meeting/${meetingId}?name=${encodeURIComponent(displayName)}&passcode=${encodeURIComponent(passcode)}`);
  };

  const handleSchedule = async (data: { title: string; description: string; scheduled_at: string; duration_minutes: number }) => {
    try {
      const meeting = await api.scheduleMeeting(data);
      await fetchMeetings();
      return meeting;
    } catch (err) {
      console.error(err);
      throw err;
    }
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
