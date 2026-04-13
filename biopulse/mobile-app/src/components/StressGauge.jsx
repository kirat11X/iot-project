import React from 'react';

export function StressGauge({ stressIndex = null, label = 'WAITING', color = '#918fa1' }) {
  const normalizedStress = stressIndex === null ? 0 : Math.min(100, Math.max(0, stressIndex));
  const offset = 283 - (283 * normalizedStress) / 100;

  return (
    <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Radial background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)`,
        borderRadius: '50%',
        transition: 'background 0.8s ease'
      }} />

      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
        viewBox="0 0 100 100"
      >
        {/* Track */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="#29283a" strokeWidth="3" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke={color}
          strokeDasharray="283"
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="6"
          style={{
            transition: 'stroke-dashoffset 0.8s ease, stroke 0.8s ease',
            filter: `drop-shadow(0 0 8px ${color}80)`
          }}
        />
      </svg>

      {/* Inner content */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#918fa1', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>
          Stress Index
        </div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 72, fontWeight: 700, lineHeight: 1,
          color: '#e3e0f8',
          transition: 'color 0.8s ease'
        }}>
          {stressIndex ?? '--'}
        </div>
        <div style={{
          marginTop: 12, padding: '4px 16px', borderRadius: 999,
          background: `${color}22`, border: `1px solid ${color}55`,
          color: color, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          transition: 'all 0.8s ease', display: 'inline-block'
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}
