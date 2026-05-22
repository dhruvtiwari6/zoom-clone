'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith('/meeting/')) return null;

  return (
    <header className="header">
      {/* Left logo branding */}
      <div className="header-logo" onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ color: '#0B5CFF', fontWeight: 800, fontSize: 20, fontFamily: 'sans-serif', letterSpacing: '-0.8px' }}>zoom</span>
        <span style={{ color: '#1B1C20', fontWeight: 500, fontSize: 13, letterSpacing: '-0.1px' }}>Workplace</span>
      </div>

      {/* Center Search Pill */}
      <div className="header-search">
        <span className="material-symbols-outlined search-icon">search</span>
        <input type="text" placeholder="Search Ctrl+K" id="search-input" />
      </div>

      {/* Right controls */}
      <div className="header-right">
        <div className="header-avatar" id="user-avatar">
          D
        </div>
      </div>
    </header>
  );
}
