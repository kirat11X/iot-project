import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

export function AnalysisRadarChart({ data }) {
  // data matches structure: [{ subject: 'Metric', value: 80 }, ...]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="#464555" strokeOpacity={0.5} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#e3e0f8', fontSize: 10, fontWeight: 600 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar 
            name="Student Profile" 
            dataKey="value" 
            stroke="#6C63FF" 
            fill="#6C63FF" 
            strokeWidth={2}
            fillOpacity={0.5} 
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
