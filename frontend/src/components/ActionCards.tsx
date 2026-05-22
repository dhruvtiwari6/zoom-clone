'use client';
import React from 'react';

interface ActionCardsProps {
  onNewMeeting: () => void;
  onJoinMeeting: () => void;
  onSchedule: () => void;
}

export default function ActionCards({ onNewMeeting, onJoinMeeting, onSchedule }: ActionCardsProps) {
  return (
    <div className="workplace-actions-row">
      {/* New Meeting Button */}
      <div className="action-circle-container" onClick={onNewMeeting} id="btn-new-meeting">
        <div className="action-circle orange">
          <span className="material-symbols-outlined circle-icon">videocam</span>
        </div>
        <div className="action-circle-label-row">
          <span className="circle-label">New meeting</span>
          <span className="material-symbols-outlined dropdown-chevron">keyboard_arrow_down</span>
        </div>
      </div>

      {/* Join Button */}
      <div className="action-circle-container" onClick={onJoinMeeting} id="btn-join-meeting">
        <div className="action-circle blue">
          <span className="material-symbols-outlined circle-icon" style={{ fontVariationSettings: "'wght' 600" }}>add</span>
        </div>
        <span className="circle-label">Join</span>
      </div>

      {/* Schedule Button */}
      <div className="action-circle-container" onClick={onSchedule} id="btn-schedule-meeting">
        <div className="action-circle blue">
          <span className="material-symbols-outlined circle-icon">calendar_today</span>
        </div>
        <span className="circle-label">Schedule</span>
      </div>
    </div>
  );
}
