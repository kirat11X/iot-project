import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export function SparkLine({ data = [], colorHex = '#6C63FF' }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => (typeof d === 'number' ? d : d.value ?? 0));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.15 || 2;
  const chartData = vals.map(v => ({ v }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <YAxis domain={[min - pad, max + pad]} hide />
        <Line
          type="monotone"
          dataKey="v"
          stroke={colorHex}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
