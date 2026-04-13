import React, { useState } from 'react';
import { BioPulseLogo } from '../components/BioPulseLogo';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { AnalysisRadarChart } from '../components/RadarChart';
import { TrendingUp, AlertTriangle, Users } from 'lucide-react';

const mockCohort = Array.from({length: 12}, (_, i) => ({
  studentId: `S${i+1}`,
  intervals: Array.from({length: 7}, (_, j) => ({ stressAvg: 20 + ((i*j*7 + i*3 + j*11) % 70) }))
}));

const radarData = [
  { subject: 'Attention', value: 85 },
  { subject: 'Cognitive Load', value: 65 },
  { subject: 'Stress Resilience', value: 45 },
  { subject: 'Consistency', value: 70 },
  { subject: 'Baseline Calm', value: 60 },
];

const intervals = ['09:00','09:10','09:20','09:30','09:40','09:50','10:00'];

export function Analysis() {
  const [view, setView] = useState('class');

  const cardBg = 'linear-gradient(135deg, rgba(135,129,255,0.05) 0%, rgba(30,30,47,1) 100%)';

  return (
    <main style={{ minHeight:'100vh', paddingTop:80, paddingBottom:100, padding:'80px 16px 100px', maxWidth:480, margin:'0 auto' }}>
      <header style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, background:'rgba(12,12,29,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(70,69,85,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px' }}>
          <BioPulseLogo size="small" />
        </div>
      </header>

      <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:26, fontWeight:700, color:'#e3e0f8', marginBottom:4 }}>Cohort Analysis</h2>
      <p style={{ fontSize:13, color:'#918fa1', fontStyle:'italic', marginBottom:20 }}>Advanced Neuro-Biology — Room 402</p>

      {/* Toggle */}
      <div style={{ display:'flex', background:'#29283a', borderRadius:12, padding:4, marginBottom:24, gap:4 }}>
        {['individual','class'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex:1, padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
            textTransform:'uppercase', letterSpacing:'0.1em',
            background: view===v ? '#c4c0ff' : 'transparent',
            color: view===v ? '#2000a4' : '#c7c4d8',
            transition:'all 0.2s ease',
          }}>
            {v === 'individual' ? 'Individual' : 'Class Avg'}
          </button>
        ))}
      </div>

      {view === 'individual' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:cardBg, borderRadius:20, padding:20, borderTop:'1px solid rgba(70,69,85,0.3)', height:300 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <Users style={{ color:'#c4c0ff', width:16, height:16 }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:600, color:'#e3e0f8' }}>Cognitive Load Profile</span>
            </div>
            <div style={{ height:240 }}>
              <AnalysisRadarChart data={radarData} />
            </div>
          </div>
          <div style={{ background:cardBg, borderRadius:20, padding:20, borderTop:'1px solid rgba(70,69,85,0.3)' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#918fa1', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:12 }}>Auto-Generated Insight</p>
            <p style={{ fontSize:15, lineHeight:1.7, color:'#e3e0f8' }}>
              Subject exhibits <span style={{ color:'#EF4444', fontWeight:700 }}>elevated cognitive load (85%)</span> during deductive tasks. Stress resilience scores indicate potential benefit from 2-minute breathing intervals between assessment blocks.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Heatmap */}
          <div style={{ background:cardBg, borderRadius:20, padding:20, borderTop:'1px solid rgba(70,69,85,0.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:600, color:'#e3e0f8' }}>Neural Flux Heatmap</span>
              <div style={{ display:'flex', gap:10 }}>
                {[['#10B981','Calm'],['#F59E0B','Alert'],['#EF4444','Stress']].map(([c,l]) => (
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:8, height:8, background:c, borderRadius:2, display:'block' }} />
                    <span style={{ fontSize:10, color:'#918fa1' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Time headers */}
            <div style={{ display:'grid', gridTemplateColumns:'2rem 1fr', gap:8, marginBottom:4 }}>
              <div />
              <div style={{ display:'grid', gridTemplateColumns:`repeat(7,1fr)`, gap:4 }}>
                {intervals.map(t => <div key={t} style={{ fontSize:8, color:'#918fa1', textAlign:'center', fontWeight:600 }}>{t}</div>)}
              </div>
            </div>
            <HeatmapGrid cohortData={mockCohort} />
          </div>

          {/* Critical intervals bar chart */}
          <div style={{ background:cardBg, borderRadius:20, padding:20, borderTop:'1px solid rgba(70,69,85,0.3)' }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:16, fontWeight:600, color:'#e3e0f8', display:'block', marginBottom:16 }}>Critical Intervals</span>
            {[['09:30-09:40', 88, '#EF4444'],['09:20-09:30', 64, '#F59E0B'],['09:50-10:00', 42, '#adc6ff']].map(([slot,pct,color]) => (
              <div key={slot} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:500, color:'#e3e0f8' }}>{slot}</span>
                  <span style={{ fontSize:17, fontWeight:700, color }}>{pct}%</span>
                </div>
                <div style={{ width:'100%', height:6, background:'#1a1a2b', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, boxShadow:`0 0 8px ${color}60`, transition:'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Insight cards */}
          <div style={{ background:cardBg, borderRadius:20, padding:20, borderTop:'1px solid rgba(70,69,85,0.3)', borderLeft:'4px solid rgba(239,68,68,0.5)' }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ background:'rgba(239,68,68,0.15)', padding:10, borderRadius:'50%', flexShrink:0 }}>
                <TrendingUp style={{ color:'#EF4444', width:18, height:18 }} />
              </div>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'#e3e0f8', marginBottom:4 }}>Peak classroom stress at 09:30 AM</p>
                <p style={{ fontSize:13, color:'#c7c4d8', lineHeight:1.6 }}>Collective spike in cortisol markers during mid-session. Consider extending rest intervals.</p>
              </div>
            </div>
          </div>

          <div style={{ background:cardBg, borderRadius:20, padding:20, borderTop:'1px solid rgba(70,69,85,0.3)', borderLeft:'4px solid rgba(196,192,255,0.5)' }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ background:'rgba(196,192,255,0.15)', padding:10, borderRadius:'50%', flexShrink:0 }}>
                <AlertTriangle style={{ color:'#c4c0ff', width:18, height:18 }} />
              </div>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'#e3e0f8', marginBottom:4 }}>5/12 students elevated GSR during quiz</p>
                <p style={{ fontSize:13, color:'#c7c4d8', lineHeight:1.6 }}>GSR anomalies in 41% of cohort. Correlation with complex problem sets detected.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
