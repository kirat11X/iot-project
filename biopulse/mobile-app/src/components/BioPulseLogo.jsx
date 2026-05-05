import React from 'react';

export function BioPulseLogo({ size = 'small' }) {
  const isLarge = size === 'large';
  const w = isLarge ? 240 : 160;
  const h = isLarge ? 80 : 44;

  return (
    <svg width={w} height={h} viewBox="0 0 240 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
      <defs>
        <filter id="glow-logo">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6C63FF" floodOpacity="0.8" />
        </filter>
      </defs>
      {/* Heartbeat pulse line */}
      <g filter="url(#glow-logo)">
        <polyline
          points="8,40 24,40 32,20 40,60 48,30 56,48 64,40 80,40"
          stroke="#6C63FF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* WiFi arcs */}
        <path d="M70 26 Q 82 14 94 26" stroke="#6C63FF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8"/>
        <path d="M74 18 Q 82 8 90 18" stroke="#6C63FF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6"/>
        <circle cx="82" cy="36" r="2.5" fill="#6C63FF" opacity="0.9"/>
      </g>

      {/* IoT text */}
      <text
        x="102" y={isLarge ? 44 : 40}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight="700"
        fontSize={isLarge ? 34 : 28}
        fill="#6C63FF"
      >IoT</text>

      {/* BioPulse sub-text */}
      <text
        x="102" y={isLarge ? 66 : 58}
        fontFamily="'Inter', sans-serif"
        fontWeight="400"
        fontSize={isLarge ? 18 : 14}
        fill="#F0F4FF"
        opacity="0.9"
      >BioPulse</text>
    </svg>
  );
}
