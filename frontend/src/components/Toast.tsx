'use client';
import React from 'react';

export interface ToastItem {
  id: number;
  msg: string;
  type: 'info' | 'success' | 'error';
}

interface Props { toasts: ToastItem[]; }

export default function ToastContainer({ toasts }: Props) {
  if (!toasts.length) return null;
  const bg: Record<string, string> = {
    info: '#333',
    success: '#1a6b2e',
    error: '#991b1b',
  };
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: bg[t.type], color: '#fff', padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', animation: 'slideDown 0.3s ease', whiteSpace: 'nowrap' }}>
          {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.msg}
        </div>
      ))}
    </div>
  );
}
