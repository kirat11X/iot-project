import React from 'react';
import { SparkLine } from './SparkLine';

export function VitalsCard({ icon, colorHex = '#c4c0ff', bgColorHex = 'rgba(196,192,255,0.1)', label, value, unit, status, sparklineData = [] }) {
  const iconNode = icon ? React.createElement(icon, { style: { color: colorHex, width: 20, height: 20 } }) : null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(135,129,255,0.05) 0%, rgba(30,30,47,1) 100%)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(70,69,85,0.3)',
      borderRadius: 16,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: 160,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      transition: 'transform 0.15s ease',
      cursor: 'default',
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ background: bgColorHex, padding: 8, borderRadius: 12 }}>
          {iconNode}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#c7c4d8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: '#e3e0f8' }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: 10, color: colorHex, fontWeight: 700, textTransform: 'uppercase', marginLeft: 2 }}>{unit}</span>}
          {status && <span style={{ fontSize: 12, color: colorHex, marginLeft: 4 }}>{status}</span>}
        </div>
        <div style={{ marginTop: 10, height: 40, width: '100%', overflow: 'hidden', opacity: 0.7 }}>
          <SparkLine data={sparklineData} colorHex={colorHex} />
        </div>
      </div>
    </div>
  );
}
