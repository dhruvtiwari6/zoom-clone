'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { icon: 'home', label: 'Home', href: '/' },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith('/meeting/')) return null;

  const handleNav = (href: string) => {
    if (onClose) onClose();
    if (href !== '#') router.push(href);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full py-4 bg-white">
      <div className="flex flex-col items-center gap-5 w-full">
        <div className="sidebar-logo" onClick={() => handleNav('/')} style={{ cursor: 'pointer' }}>
          <svg viewBox="0 0 48 48" fill="none" style={{ width: 28, height: 28 }}>
            <rect width="48" height="48" rx="10" fill="#0B5CFF"/>
            <path d="M14 17.5C14 16.12 15.12 15 16.5 15H26.5C27.88 15 29 16.12 29 17.5V27.5C29 28.88 27.88 30 26.5 30H16.5C15.12 30 14 28.88 14 27.5V17.5Z" fill="white"/>
            <path d="M29 21L34.5 17V28L29 24V21Z" fill="white"/>
          </svg>
        </div>

        <div className="sidebar-items-container w-full flex flex-col items-center gap-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <div
                key={item.label}
                onClick={() => handleNav(item.href)}
                className={`sidebar-item flex flex-col items-center justify-center w-full py-2 cursor-pointer transition-colors text-gray-500 hover:text-black ${isActive ? 'text-[#0B5CFF] active' : ''}`}
              >
                <span className="material-symbols-outlined sidebar-icon text-[22px]">{item.icon}</span>
                <span className="sidebar-label text-[10px] font-medium mt-1">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-item settings-item flex flex-col items-center justify-center w-full py-2 cursor-pointer text-gray-500 hover:text-black">
        <span className="material-symbols-outlined sidebar-icon text-[22px]">settings</span>
      </div>
    </div>
  );
}
