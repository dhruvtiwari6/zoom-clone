'use client';
import React, { useState, useEffect } from 'react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: { title: string; description: string; scheduled_at: string; duration_minutes: number; passcode?: string }) => Promise<any>;
}

const generate6LetterPasscode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function ScheduleModal({ isOpen, onClose, onSchedule }: ScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(40);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMeeting, setSuccessMeeting] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode(generate6LetterPasscode());
      setSuccessMeeting(null);
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a meeting title'); return; }
    if (!date || !time) { setError('Please select date and time'); return; }
    if (!passcode.trim()) { setError('Please enter a passcode'); return; }
    
    const scheduled_at = new Date(`${date}T${time}`).toISOString();
    setError('');
    setIsSubmitting(true);
    
    try {
      const createdMeeting = await onSchedule({
        title: title.trim(),
        description: description.trim(),
        scheduled_at,
        duration_minutes: duration,
        passcode: passcode.trim(),
      });
      setSuccessMeeting(createdMeeting);
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule meeting. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGoogleCalendarUrl = (m: any) => {
    if (!m || !m.scheduled_at) return '#';
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
    
    const calendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
    return `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(calendarUrl)}`;
  };

  // Minimum date is today
  const today = new Date().toISOString().split('T')[0];

  if (successMeeting) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
          <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h2 style={{ width: '100%', textAlign: 'center', fontSize: '20px', marginTop: '16px' }}>Meeting Scheduled!</h2>
            <button className="modal-close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--zoom-success)' }}>
                task_alt
              </span>
            </div>
            
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              {successMeeting.title}
            </h3>
            
            <p style={{ fontSize: '14px', color: 'var(--zoom-text-secondary)', marginBottom: '24px' }}>
              Your meeting has been successfully scheduled and stored in the database.
            </p>

            <div style={{
              background: 'rgba(14, 113, 235, 0.04)',
              border: '1px solid rgba(14, 113, 235, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#4A5568',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '24px'
            }}>
              <div><strong style={{ color: '#1A202C' }}>Meeting ID:</strong> <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#1A202C', fontWeight: 600 }}>{successMeeting.meeting_id}</span></div>
              <div><strong style={{ color: '#1A202C' }}>Passcode:</strong> <code style={{ color: '#0E71EB', background: 'rgba(14, 113, 235, 0.12)', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '14px', marginLeft: '4px' }}>{successMeeting.passcode}</code></div>
              <div><strong style={{ color: '#1A202C' }}>Scheduled Time:</strong> <span style={{ color: '#1A202C' }}>{new Date(successMeeting.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a 
                href={getGoogleCalendarUrl(successMeeting)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#4285F4',
                  borderColor: '#4285F4',
                  height: '40px',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_month</span>
                Add to Google Calendar
              </a>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
                style={{ height: '40px', borderRadius: '8px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Meeting</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="schedule-title">Meeting Title</label>
              <input id="schedule-title" type="text" placeholder="e.g., Weekly Team Standup" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="schedule-desc">Description (optional)</label>
              <textarea id="schedule-desc" placeholder="Add a description for your meeting..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-row grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="form-group">
                <label htmlFor="schedule-date">Date</label>
                <input id="schedule-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="schedule-time">Time</label>
                <input id="schedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="schedule-duration">Duration</label>
              <select id="schedule-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={40}>40 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="schedule-passcode">Security Passcode (6 characters)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="schedule-passcode"
                  type="text"
                  placeholder="e.g., aB3dE6"
                  maxLength={15}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setPasscode(generate6LetterPasscode())}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F1F3F5',
                    border: '1px solid #CCCCCC',
                    borderRadius: '8px',
                    width: '38px',
                    height: '38px',
                    cursor: 'pointer',
                    color: '#6E7687',
                    transition: 'background 0.2s',
                  }}
                  title="Generate new random passcode"
                  onMouseEnter={(e) => e.currentTarget.style.background = '#E5E7EB'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#F1F3F5'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#747B8B', marginTop: '4px' }}>
                Required to join. Type your own custom code above or click refresh to generate a new one.
              </p>
            </div>

            {error && <p style={{ color: 'var(--zoom-danger)', fontSize: '13px' }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="schedule-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
