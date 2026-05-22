'use client';
import React, { useState, useEffect } from 'react';

export default function DateTimeCard() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const h12 = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  const mins = now.getMinutes().toString().padStart(2, '0');
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  return (
    <div className="workplace-clock-container">
      <div className="workplace-time">
        {h12}:{mins} <span className="time-period">{period}</span>
      </div>
      <div className="workplace-date">{dateStr}</div>
    </div>
  );
}
