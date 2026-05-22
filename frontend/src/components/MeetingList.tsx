'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting } from '@/types';

interface MeetingListProps {
  upcoming: Meeting[];
  recent: Meeting[];
  onRefresh: () => void;
}

export default function MeetingList({ upcoming, recent, onRefresh }: MeetingListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recent'>('upcoming');

  const getTodayDateStr = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const formatTimeInterval = (scheduledAt: string | null, duration: number) => {
    if (!scheduledAt) return '';
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const formatTime = (d: Date) => {
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    };
    
    const isToday = new Date().toDateString() === start.toDateString();
    const timeStr = `${formatTime(start)} - ${formatTime(end)}`;
    
    if (isToday) {
      return timeStr;
    } else {
      const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${dateStr}, ${timeStr}`;
    }
  };

  const formatEndedTime = (endedAt: string | null) => {
    if (!endedAt) return 'Recently';
    const end = new Date(endedAt);
    const isToday = new Date().toDateString() === end.toDateString();
    const formatTime = (d: Date) => {
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    };
    
    if (isToday) {
      return `Ended today at ${formatTime(end)}`;
    } else {
      const dateStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `Ended on ${dateStr} at ${formatTime(end)}`;
    }
  };

  const handleStart = (meetingId: string) => {
    router.push(`/meeting/${meetingId}`);
  };

  return (
    <div className="workplace-calendar-card">
      {/* Card Header controls */}
      <div className="calendar-card-header">
        <div className="calendar-card-title-group">
          <span className="calendar-card-title">{getTodayDateStr()}</span>
        </div>
        <div className="calendar-card-actions">
          <button className="calendar-refresh-btn" onClick={onRefresh} title="Refresh meetings">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="meeting-tabs-row">
        <button 
          className={`meeting-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <span className="material-symbols-outlined tab-icon">schedule</span>
          Upcoming ({upcoming.length})
        </button>
        <button 
          className={`meeting-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          <span className="material-symbols-outlined tab-icon">history</span>
          Recent ({recent.length})
        </button>
      </div>

      {/* Calendar Card Body */}
      <div className="calendar-card-body">
        {activeTab === 'upcoming' ? (
          upcoming.length > 0 ? (
            upcoming.map((m, index) => (
              <div className="workplace-meeting-item" key={m.meeting_id || index}>
                <div className="meeting-item-details">
                  <div className="meeting-item-title-row">
                    <span className="meeting-item-title">{m.title || 'My Meeting'}</span>
                    {index === 0 && <span className="new-badge">New</span>}
                  </div>
                  <div className="meeting-item-time">
                    {formatTimeInterval(m.scheduled_at, m.duration_minutes)}
                  </div>
                  <div className="meeting-item-host">
                    Host: {m.host?.name || 'dhruv tiwari'}
                  </div>
                </div>
                <button className="btn-start-meeting" onClick={() => handleStart(m.meeting_id)}>
                  Start
                </button>
              </div>
            ))
          ) : (
            <div className="empty-meetings-state">
              <span className="material-symbols-outlined empty-icon">event_busy</span>
              <p className="empty-title">No upcoming meetings</p>
              <p className="empty-subtitle">Click 'New Meeting' or 'Schedule' above to start one.</p>
            </div>
          )
        ) : (
          recent.length > 0 ? (
            recent.map((m, index) => (
              <div className="workplace-meeting-item" key={m.meeting_id || index}>
                <div className="meeting-item-details">
                  <div className="meeting-item-title-row">
                    <span className="meeting-item-title">{m.title || 'My Meeting'}</span>
                    <span className="ended-badge">Ended</span>
                  </div>
                  <div className="meeting-item-time">
                    {formatEndedTime(m.ended_at)}
                  </div>
                  <div className="meeting-item-host">
                    Host: {m.host?.name || 'dhruv tiwari'}
                  </div>
                </div>
                <button className="btn-rejoin-meeting" onClick={() => handleStart(m.meeting_id)}>
                  Rejoin
                </button>
              </div>
            ))
          ) : (
            <div className="empty-meetings-state">
              <span className="material-symbols-outlined empty-icon">history_toggle_off</span>
              <p className="empty-title">No recent meetings</p>
              <p className="empty-subtitle">Completed meetings will appear here.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
