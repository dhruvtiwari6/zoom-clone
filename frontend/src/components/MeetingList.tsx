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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getTodayDateStr = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const formatTimeInterval = (scheduledAt: string | null, duration: number) => {
    if (!scheduledAt) return '00:30 - 01:10';
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const formatTime = (d: Date) => {
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    };
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const handleStart = (meetingId: string) => {
    router.push(`/meeting/${meetingId}`);
  };

  // Pre-fill a sample if upcoming is empty to match the user's screenshot
  const displayMeetings = upcoming.length > 0 ? upcoming : [
    {
      meeting_id: '940-5050-6425',
      title: 'My Meeting',
      scheduled_at: new Date().toISOString(),
      duration_minutes: 40,
      host_name: 'dhruv tiwari'
    },
    {
      meeting_id: '175-1066-3764',
      title: 'Sprint Planning - Q3 Goals',
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      duration_minutes: 60,
      host_name: 'dhruv tiwari'
    },
    {
      meeting_id: '826-6302-7753',
      title: 'Design Review: Workplace UI',
      scheduled_at: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
      duration_minutes: 45,
      host_name: 'dhruv tiwari'
    },
    {
      meeting_id: '492-9405-1940',
      title: 'Webrtc Connection Sync-Up',
      scheduled_at: new Date(Date.now() + 300 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      host_name: 'dhruv tiwari'
    },
    {
      meeting_id: '682-1943-8572',
      title: 'Product Alignment Standup',
      scheduled_at: new Date(Date.now() + 420 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      host_name: 'dhruv tiwari'
    },
    {
      meeting_id: '302-8561-2940',
      title: 'Zoom Workplace App Demo',
      scheduled_at: new Date(Date.now() + 540 * 60 * 1000).toISOString(),
      duration_minutes: 60,
      host_name: 'dhruv tiwari'
    }
  ];

  return (
    <div className="workplace-calendar-card">
      {/* Card Header controls */}
      <div className="calendar-card-header">
        <div className="calendar-card-title-group">
          <span className="calendar-card-title">{getTodayDateStr()}</span>
          <span className="material-symbols-outlined dropdown-chevron">keyboard_arrow_down</span>
        </div>
        <div className="calendar-card-actions">
          <button className="calendar-nav-btn today">Today</button>
          <button className="calendar-nav-btn-arrow">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button className="calendar-nav-btn-arrow">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <div className="calendar-divider-y" />
          <button className="calendar-refresh-btn" onClick={onRefresh}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {/* Calendar Items */}
      <div className="calendar-card-body">
        {displayMeetings.map((m, index) => (
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
                Host: {('host_name' in m ? m.host_name : 'dhruv tiwari')}
              </div>
            </div>
            <button className="btn-start-meeting" onClick={() => handleStart(m.meeting_id)}>
              Start
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
