import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a2b',
  borderColor: '#464555',
  borderRadius: 12,
  color: '#e3e0f8',
  fontSize: 12,
};

const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function SessionChart({ data, spikes = [] }) {
  if (!data?.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#918fa1', fontSize: 13 }}>
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gStress" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gGSR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="timestamp" tickFormatter={fmtTime} stroke="#464555" tick={{ fill: '#918fa1', fontSize: 10 }} minTickGap={30} />
        <YAxis hide />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtTime} />
        {spikes.map((t, i) => <ReferenceLine key={i} x={t} stroke="#EF4444" strokeDasharray="3 3" />)}
        <Area type="monotone" dataKey="stressIndex" stroke="#EF4444" strokeWidth={2} fill="url(#gStress)" fillOpacity={1} />
        <Area type="monotone" dataKey="gsr"         stroke="#F59E0B" strokeWidth={1.5} fill="url(#gGSR)" fillOpacity={1} />
        <Area type="monotone" dataKey="heartRate"   stroke="#3B82F6" strokeWidth={1} fillOpacity={0} opacity={0.6} strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
