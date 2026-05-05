// src/screens/Analysis.jsx
// Powered by real readings.csv data via /api/csv-session
import React, { useState } from 'react';
import { BioPulseLogo } from '../components/BioPulseLogo';
import { AnalysisRadarChart } from '../components/RadarChart';
import { TrendingUp, AlertTriangle, Activity, Thermometer, Zap, HeartPulse, Loader } from 'lucide-react';
import { useCsvData } from '../hooks/useCsvData';
import { useStress } from '../context/useStress';

// ─── Colour helpers ───────────────────────────────────────────────
const LABEL_COLOR  = { CALM: '#10B981', MODERATE: '#F59E0B', STRESSED: '#EF4444', CRITICAL: '#c4c0ff' };
const LABEL_BG     = { CALM: 'rgba(16,185,129,0.12)', MODERATE: 'rgba(245,158,11,0.12)', STRESSED: 'rgba(239,68,68,0.12)', CRITICAL: 'rgba(196,192,255,0.12)' };

function Pill({ label }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      background: LABEL_BG[label] || 'rgba(70,69,85,0.15)',
      color: LABEL_COLOR[label] || '#918fa1',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
    }}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, unit, color = '#c4c0ff' }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(135,129,255,0.05) 0%,rgba(18,18,34,1) 100%)',
      borderRadius: 16, padding: '16px 14px',
      borderTop: `1px solid ${color}33`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon style={{ width: 14, height: 14, color }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: '#e3e0f8' }}>{value ?? '—'}</span>
        {unit && <span style={{ fontSize: 12, color: '#918fa1' }}>{unit}</span>}
      </div>
    </div>
  );
}

function LabelBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = LABEL_COLOR[label] || '#918fa1';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, background: color, borderRadius: 2, display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e3e0f8' }}>{label}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ width: '100%', height: 6, background: 'rgba(70,69,85,0.25)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, boxShadow: `0 0 8px ${color}60`, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: '#918fa1', marginTop: 2, display: 'block' }}>{count} readings</span>
    </div>
  );
}

// Mini HR timeline sparkline (SVG)
function HrTimeline({ rows }) {
  if (!rows || rows.length === 0) return null;
  const W = 320, H = 60, PAD = 4;
  const hrs = rows.map(r => r.heart_rate);
  const minH = Math.min(...hrs), maxH = Math.max(...hrs);
  const range = maxH - minH || 1;
  const pts = hrs.map((v, i) => {
    const x = PAD + (i / (hrs.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - minH) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke="#c4c0ff" strokeWidth="1.5" strokeLinejoin="round" />
        {/* avg line */}
        {(() => {
          const avgY = H - PAD - ((hrs.reduce((a, b) => a + b, 0) / hrs.length - minH) / range) * (H - PAD * 2);
          return <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY} stroke="#c4c0ff44" strokeDasharray="4 4" strokeWidth="1" />;
        })()}
      </svg>
    </div>
  );
}

// GSR timeline sparkline (SVG)
function GsrTimeline({ rows }) {
  if (!rows || rows.length === 0) return null;
  const W = 320, H = 50, PAD = 4;
  const vals = rows.map(r => r.gsr);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const pts = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - minV) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#ffb785" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Radar data built from summary
function buildRadarData(summary) {
  if (!summary) return [];
  const total = summary.total_rows || 1;
  const calmPct = (summary.label_counts?.CALM || 0) / total * 100;
  const modPct  = (summary.label_counts?.MODERATE || 0) / total * 100;
  const strPct  = (summary.label_counts?.STRESSED || 0) / total * 100;
  // Normalize HR to a 0-100 "attention" proxy: higher steady HR in moderate range = more attentive
  const hrScore = Math.min(100, Math.max(0, ((summary.avg_hr - 50) / 100) * 100));
  const gsrScore= Math.min(100, (summary.avg_gsr / 10) * 100);
  return [
    { subject: 'Avg HR Signal',      value: Math.round(hrScore)               },
    { subject: 'GSR Activity',        value: Math.round(gsrScore)              },
    { subject: 'Stress Resilience',  value: Math.round(100 - summary.avg_stress) },
    { subject: 'Calm Ratio',          value: Math.round(calmPct)               },
    { subject: 'Baseline Stability',  value: Math.round(100 - modPct - strPct) },
  ];
}

const CARD_BG = 'linear-gradient(135deg,rgba(135,129,255,0.05) 0%,rgba(30,30,47,1) 100%)';

export function Analysis() {
  const [view, setView] = useState('session');
  const { state } = useStress();
  const serverIp = state?.settings?.serverIp || 'localhost';
  const { rows, summary, loading, error } = useCsvData(serverIp);

  const totalRows = summary?.total_rows || 0;

  return (
    <main style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 100, padding: '80px 16px 100px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(12,12,29,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(70,69,85,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
          <BioPulseLogo size="small" />
          {loading && <Loader style={{ width: 16, height: 16, color: '#c4c0ff', animation: 'spin 1s linear infinite' }} />}
          {summary && <Pill label={summary.dominant_label} />}
        </div>
      </header>

      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: '#e3e0f8', marginBottom: 2 }}>
        Session Analysis
      </h2>
      <p style={{ fontSize: 13, color: '#918fa1', fontStyle: 'italic', marginBottom: 20 }}>
        Student S01 · {totalRows} valid readings · avg {summary ? `${summary.duration_s}s` : '—'} session
      </p>

      {/* Tab Toggle */}
      <div style={{ display: 'flex', background: '#29283a', borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
        {[['session', 'Session Stats'], ['trends', 'HR / GSR Trends'], ['labels', 'Stress Breakdown'], ['ml', 'ML Engine Data']].map(([v, lbl]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            background: view === v ? '#c4c0ff' : 'transparent',
            color: view === v ? '#2000a4' : '#c7c4d8',
            transition: 'all 0.2s ease',
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>⚠ Could not load CSV session</p>
          <p style={{ fontSize: 12, color: '#c7c4d8', marginTop: 4 }}>Make sure the BioPulse backend is running on port 3001. ({error})</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[64, 48, 80].map((h, i) => (
            <div key={i} style={{ height: h, background: 'rgba(70,69,85,0.15)', borderRadius: 14, animation: 'pulse 1.5s ease infinite' }} />
          ))}
        </div>
      )}

      {/* ── SESSION STATS tab ──────────────────────────────────── */}
      {!loading && view === 'session' && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 2×2 stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard icon={HeartPulse} label="Avg Heart Rate"  value={summary.avg_hr}      unit="BPM"  color="#c4c0ff" />
            <StatCard icon={Zap}        label="Avg GSR"          value={summary.avg_gsr}     unit="%"    color="#ffb785" />
            <StatCard icon={Thermometer}label="Avg Temperature"  value={summary.avg_temp}    unit="°C"   color="#adc6ff" />
            <StatCard icon={Activity}   label="Avg Stress Index" value={summary.avg_stress}  unit="/100" color="#EF4444" />
          </div>

          {/* HR range card */}
          <div style={{ background: CARD_BG, borderRadius: 18, padding: '16px 18px', borderTop: '1px solid rgba(196,192,255,0.2)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Heart Rate Range</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 10, color: '#918fa1', marginBottom: 2 }}>MIN</p>
                <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 700, color: '#10B981' }}>{summary.min_hr}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#918fa1', marginBottom: 2 }}>AVG</p>
                <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 700, color: '#e3e0f8' }}>{summary.avg_hr}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, color: '#918fa1', marginBottom: 2 }}>PEAK</p>
                <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 700, color: '#EF4444' }}>{summary.peak_hr}</p>
              </div>
            </div>
            {/* Bar showing position of avg */}
            <div style={{ marginTop: 10, width: '100%', height: 4, background: 'rgba(70,69,85,0.2)', borderRadius: 99, overflow: 'visible', position: 'relative' }}>
              <div style={{ position: 'absolute', width: `${Math.round(((summary.avg_hr - summary.min_hr) / (summary.peak_hr - summary.min_hr + 1)) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#10B981,#c4c0ff)', borderRadius: 99 }} />
            </div>
          </div>

          {/* Radar chart */}
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(70,69,85,0.3)', height: 280 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Cognitive Load Profile</p>
            <div style={{ height: 220 }}>
              <AnalysisRadarChart data={buildRadarData(summary)} />
            </div>
          </div>
        </div>
      )}

      {/* ── TRENDS tab ────────────────────────────────────────── */}
      {!loading && view === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(196,192,255,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <HeartPulse style={{ width: 14, height: 14, color: '#c4c0ff' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e3e0f8' }}>Heart Rate Timeline</span>
              <span style={{ fontSize: 10, color: '#918fa1', marginLeft: 'auto' }}>{rows.length} pts · filtered ≤200 BPM</span>
            </div>
            <HrTimeline rows={rows} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: '#918fa1' }}>▲ {summary?.peak_hr} BPM peak</span>
              <span style={{ fontSize: 10, color: '#918fa1' }}>avg {summary?.avg_hr} BPM</span>
            </div>
          </div>

          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(255,183,133,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Zap style={{ width: 14, height: 14, color: '#ffb785' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e3e0f8' }}>GSR Timeline</span>
              <span style={{ fontSize: 10, color: '#918fa1', marginLeft: 'auto' }}>0–10% sensor range</span>
            </div>
            <GsrTimeline rows={rows} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: '#918fa1' }}>peak {summary?.peak_gsr}%</span>
              <span style={{ fontSize: 10, color: '#918fa1' }}>avg {summary?.avg_gsr}%</span>
            </div>
          </div>

          {/* Env data */}
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(173,198,255,0.3)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Environment</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                ['Avg Temp', `${summary?.avg_temp ?? '—'}°C`, '#adc6ff'],
                ['Avg Humidity', `${summary?.avg_humidity ?? '—'}%`, '#adc6ff'],
                ['Heat Index', `${summary?.avg_heat_index ?? '—'}`, '#ffb785'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 9, color: '#918fa1', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{l}</p>
                  <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: c }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LABELS tab ────────────────────────────────────────── */}
      {!loading && view === 'labels' && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(70,69,85,0.3)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              Stress Label Distribution
            </p>
            <p style={{ fontSize: 12, color: '#c7c4d8', marginBottom: 16 }}>
              Based on pseudo-labels computed from HR, GSR and HRV per the ML preprocessing pipeline.
            </p>
            {['CALM', 'MODERATE', 'STRESSED', 'CRITICAL'].map(lbl => (
              <LabelBar key={lbl} label={lbl} count={summary.label_counts[lbl] ?? 0} total={totalRows} />
            ))}
          </div>

          {/* Dominant label insight */}
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: `4px solid ${LABEL_COLOR[summary.dominant_label] ?? '#918fa1'}33`, borderLeft: `4px solid ${LABEL_COLOR[summary.dominant_label] ?? '#918fa1'}88` }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ background: LABEL_BG[summary.dominant_label], padding: 10, borderRadius: '50%', flexShrink: 0 }}>
                <TrendingUp style={{ color: LABEL_COLOR[summary.dominant_label], width: 18, height: 18 }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#e3e0f8', marginBottom: 4 }}>
                  Dominant state: <span style={{ color: LABEL_COLOR[summary.dominant_label] }}>{summary.dominant_label}</span>
                </p>
                <p style={{ fontSize: 13, color: '#c7c4d8', lineHeight: 1.6 }}>
                  {summary.dominant_label === 'CALM' && 'Session was predominantly calm. Heart rate and GSR remained in stable resting ranges.'}
                  {summary.dominant_label === 'MODERATE' && 'Moderate arousal detected. GSR activity suggests cognitive engagement without peak stress.'}
                  {summary.dominant_label === 'STRESSED' && 'Elevated stress markers found. Consider reviewing sensor placement and ensuring proper resting baseline.'}
                  {summary.dominant_label === 'CRITICAL' && 'Critical stress levels recorded. Verify sensor quality and re-run session with proper baseline calibration.'}
                </p>
              </div>
            </div>
          </div>

          {/* GSR-HR product note */}
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(196,192,255,0.2)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(196,192,255,0.1)', padding: 10, borderRadius: '50%', flexShrink: 0 }}>
                <AlertTriangle style={{ color: '#c4c0ff', width: 18, height: 18 }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#e3e0f8', marginBottom: 4 }}>
                  GSR × HR interaction: {summary.avg_gsr_hr_product?.toFixed(2)}
                </p>
                <p style={{ fontSize: 13, color: '#c7c4d8', lineHeight: 1.6 }}>
                  HRV was 0 throughout this session (not yet computed on ESP32). 
                  Add peak-to-peak IBI detection on the firmware to unlock HRV-based stress features.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ML ENGINE tab ────────────────────────────────────────── */}
      {!loading && view === 'ml' && summary && rows?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* ML Verdict Header */}
          <div style={{ background: CARD_BG, borderRadius: 18, padding: 20, borderTop: `1px solid ${LABEL_COLOR[summary.dominant_label] || '#c4c0ff'}50`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 150, height: 150, background: `radial-gradient(circle, ${LABEL_COLOR[summary.dominant_label]}15 0%, transparent 70%)` }} />
            <p style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
              Session ML Prediction
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: LABEL_BG[summary.dominant_label], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${LABEL_COLOR[summary.dominant_label]}30` }}>
                <Activity style={{ color: LABEL_COLOR[summary.dominant_label], width: 32, height: 32 }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: '#e3e0f8', lineHeight: 1.1 }}>
                  {summary.dominant_label}
                </p>
                <p style={{ fontSize: 13, color: '#c4c0ff', fontWeight: 600, marginTop: 4 }}>
                  Computed Stress Index: {summary.avg_stress.toFixed(1)} / 100
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, borderTop: '1px solid rgba(196,192,255,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Engineered Input Features
              </p>
              <span style={{ fontSize: 10, color: '#c4c0ff', background: 'rgba(196,192,255,0.1)', padding: '4px 8px', borderRadius: 8 }}>
                Latest Row
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(140px, 1fr)', gap: 12 }}>
              {[
                { label: 'HR Mean (30s)', val: rows[rows.length-1].hr_mean_30s },
                { label: 'HR Std (30s)',  val: rows[rows.length-1].hr_std_30s },
                { label: 'HR Delta',      val: rows[rows.length-1].hr_delta },
                { label: 'HR Max (30s)',  val: rows[rows.length-1].hr_max_30s },
                { label: 'GSR Mean (30s)',val: rows[rows.length-1].gsr_mean_30s },
                { label: 'GSR Std Dev',   val: rows[rows.length-1].gsr_std_30s },
                { label: 'GSR Delta',     val: rows[rows.length-1].gsr_delta },
                { label: 'GSR Spikes',    val: rows[rows.length-1].gsr_peak_count },
                { label: 'HRV Mean (30s)',val: rows[rows.length-1].hrv_mean_30s },
                { label: 'HRV Drop',      val: rows[rows.length-1].hrv_drop },
                { label: 'Heat Index',    val: rows[rows.length-1].heat_index },
                { label: 'Temp Delta',    val: rows[rows.length-1].temp_delta },
                { label: 'Humidity Δ',    val: rows[rows.length-1].humidity_delta },
                { label: 'GSR × HR',      val: rows[rows.length-1].gsr_hr_product },
                { label: 'HRV/Temp',      val: rows[rows.length-1].hrv_temp_ratio },
                { label: 'Progress (%)',  val: (rows[rows.length-1].session_progress * 100).toFixed(1) },
              ].map(f => (
                <div key={f.label} style={{ background: 'rgba(12,12,29,0.5)', padding: 12, borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: '#918fa1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 }}>{f.label}</span>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: '#e3e0f8' }}>
                    {f.val === null || f.val === undefined ? '—' : f.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
