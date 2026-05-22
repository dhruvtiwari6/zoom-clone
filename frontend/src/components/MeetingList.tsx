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

  const getGoogleCalendarUrl = (m: Meeting) => {
    if (!m.scheduled_at) return '#';
    const start = new Date(m.scheduled_at);
    const end = new Date(start.getTime() + m.duration_minutes * 60 * 1000);
    
    const formatToUTCString = (d: Date) => {
      const year = d.getUTCFullYear();
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = d.getUTCDate().toString().padStart(2, '0');
      const hours = d.getUTCHours().toString().padStart(2, '0');
      const minutes = d.getUTCMinutes().toString().padStart(2, '0');
      const seconds = d.getUTCSeconds().toString().padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    };
    
    const dates = `${formatToUTCString(start)}/${formatToUTCString(end)}`;
    
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const location = m.invite_link || `${origin}/meeting/${m.meeting_id}?passcode=${m.passcode || ''}`;
    const details = `Join the Zoom meeting using the link below:\n${location}\n\nPasscode: ${m.passcode || 'None'}\n\n${m.description || ''}`.trim();
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: m.title || 'Zoom Meeting',
      dates: dates,
      details: details,
      location: location,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <a 
                    className="btn-add-calendar" 
                    href={getGoogleCalendarUrl(m)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="Add to Google Calendar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--zoom-text-secondary)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--zoom-text-secondary)';
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_month</span>
                  </a>
                  <button className="btn-start-meeting" onClick={() => handleStart(m.meeting_id)}>
                    Start
                  </button>
                </div>
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
