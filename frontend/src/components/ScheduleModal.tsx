'use client';
import React, { useState, useEffect } from 'react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: { title: string; description: string; scheduled_at: string; duration_minutes: number; passcode?: string }) => void;
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
  const [duration, setDuration] = useState(60);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPasscode(generate6LetterPasscode());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a meeting title'); return; }
    if (!date || !time) { setError('Please select date and time'); return; }
    if (!passcode.trim()) { setError('Please enter a passcode'); return; }
    const scheduled_at = new Date(`${date}T${time}`).toISOString();
    setError('');
    onSchedule({
      title: title.trim(),
      description: description.trim(),
      scheduled_at,
      duration_minutes: duration,
      passcode: passcode.trim(),
    });
  };

  // Minimum date is today
  const today = new Date().toISOString().split('T')[0];

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
            <div className="form-row">
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
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            
            {/* Custom passcode customization */}
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="schedule-submit">Schedule</button>
          </div>
        </form>
      </div>
    </div>
  );
}
