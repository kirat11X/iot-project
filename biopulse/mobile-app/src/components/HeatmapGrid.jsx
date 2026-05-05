import React from 'react';

function stressColor(stress) {
  if (stress > 65) return '#EF4444';
  if (stress > 35) return '#F59E0B';
  return '#10B981';
}

export function HeatmapGrid({ cohortData }) {
  if (!cohortData?.length) return null;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ minWidth: 500, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cohortData.map((student) => (
          <div key={student.studentId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 28, fontSize: 10, fontWeight: 700, color: '#918fa1', flexShrink: 0 }}>
              {student.studentId}
            </span>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${student.intervals.length}, 1fr)`, gap: 4 }}>
              {student.intervals.map((interval, i) => {
                const stress = interval.stressAvg ?? 0;
                const bg = stressColor(stress);
                return (
                  <div
                    key={i}
                    title={`${student.studentId} — Stress: ${stress.toFixed(0)}`}
                    style={{
                      height: 32, borderRadius: 6,
                      background: bg,
                      opacity: 0.25 + (stress / 100) * 0.75,
                      transition: 'transform 0.15s ease',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
