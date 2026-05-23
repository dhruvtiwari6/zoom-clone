'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Header({ onToggleSidebar, sidebarOpen }: { onToggleSidebar: () => void; sidebarOpen: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith('/meeting/')) return null;

  return (
    <header className="header flex items-center justify-between px-4 md:px-6 h-12 bg-white border-b border-gray-200">
      {/* Left logo branding & Hamburger */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-[24px]">
            {sidebarOpen ? 'close' : 'menu'}
          </span>
        </button>

        <div className="header-logo flex items-center gap-1.5 cursor-pointer select-none" onClick={() => router.push('/')}>
          <span style={{ color: '#0B5CFF', fontWeight: 800, fontSize: 20, fontFamily: 'sans-serif', letterSpacing: '-0.8px' }}>zoom</span>
          <span style={{ color: '#1B1C20', fontWeight: 500, fontSize: 13, letterSpacing: '-0.1px' }}>Workplace</span>
        </div>
      </div>

      {/* Center Search Pill */}
      <div className="header-search hidden sm:block flex-1 max-w-[400px] mx-auto relative">
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
