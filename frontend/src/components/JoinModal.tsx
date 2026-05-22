'use client';
import React, { useState } from 'react';

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (meetingId: string, displayName: string, passcode: string) => void;
}

export default function JoinModal({ isOpen, onClose, onJoin }: JoinModalProps) {
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('Dhruv Tiwari');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingId.trim()) {
      setError('Please enter a meeting ID');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    onJoin(meetingId.trim(), displayName.trim(), passcode.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Join Meeting</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="join-meeting-id">Meeting ID or Link</label>
              <input
                id="join-meeting-id"
                type="text"
                placeholder="Enter meeting ID (e.g., 123-4567-8901)"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="join-meeting-passcode">Meeting Passcode</label>
              <input
                id="join-meeting-passcode"
                type="text"
                placeholder="Enter passcode (if required)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="join-display-name">Your Name</label>
              <input
                id="join-display-name"
                type="text"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {error && <p style={{ color: 'var(--zoom-danger)', fontSize: '13px', marginTop: '-8px' }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="join-submit">Join</button>
          </div>
        </form>
      </div>
    </div>
  );
}
