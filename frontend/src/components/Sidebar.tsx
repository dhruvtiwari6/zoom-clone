'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { icon: 'home', label: 'Home', href: '/' },
  { icon: 'videocam', label: 'Meetings', href: '#' },
  { icon: 'chat', label: 'Chat', href: '#' },
  { icon: 'more_horiz', label: 'More', href: '#' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith('/meeting/')) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
        <svg viewBox="0 0 48 48" fill="none" style={{ width: 28, height: 28 }}>
          <rect width="48" height="48" rx="10" fill="#0B5CFF"/>
          <path d="M14 17.5C14 16.12 15.12 15 16.5 15H26.5C27.88 15 29 16.12 29 17.5V27.5C29 28.88 27.88 30 26.5 30H16.5C15.12 30 14 28.88 14 27.5V17.5Z" fill="white"/>
          <path d="M29 21L34.5 17V28L29 24V21Z" fill="white"/>
        </svg>
      </div>

      <div className="sidebar-items-container">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <div
              key={item.label}
              onClick={() => item.href !== '#' && router.push(item.href)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          );
        })}
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-item settings-item">
        <span className="material-symbols-outlined sidebar-icon">settings</span>
      </div>
    </aside>
  );
}
