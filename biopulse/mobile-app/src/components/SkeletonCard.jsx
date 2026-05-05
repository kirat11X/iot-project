import React from 'react';

export function SkeletonCard() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(135,129,255,0.05) 0%, rgba(30,30,47,1) 100%)',
      borderTop: '1px solid rgba(70,69,85,0.3)',
      borderRadius: 24, padding: 24, height: 160,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        animation: 'shimmer 2s ease-in-out infinite',
      }} />
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#29283a' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, background: '#29283a', borderRadius: 99, width: '60%', marginBottom: 8 }} />
          <div style={{ height: 10, background: '#29283a', borderRadius: 99, width: '40%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, height: 40, background: '#1e1e2f', borderRadius: 12 }} />
        <div style={{ width: '30%', height: 40, background: '#1e1e2f', borderRadius: 12 }} />
      </div>
    </div>
  );
}
