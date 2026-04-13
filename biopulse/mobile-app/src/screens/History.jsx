import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Upload } from 'lucide-react';
import { BioPulseLogo } from '../components/BioPulseLogo';
import { SessionChart } from '../components/SessionChart';
import { SkeletonCard } from '../components/SkeletonCard';
import { useStress } from '../context/useStress';
import { getStressLabel } from '../utils/stressAlgorithm';
import { useMLPrediction } from '../hooks/useMLPrediction';

const FILTERS = ['Today', 'This Week', 'This Month'];
const NO_DATA_META = { label: 'NO DATA', color: '#918fa1' };

function asNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function getStressMeta(avgStress) {
  if (avgStress === null || avgStress === undefined) {
    return NO_DATA_META;
  }

  const numericStress = Number(avgStress);

  if (Number.isNaN(numericStress)) {
    return NO_DATA_META;
  }

  return getStressLabel(Math.round(numericStress));
}

function formatDate(timestamp) {
  if (!timestamp) {
    return '--';
  }

  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '--:--';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt) {
    return '--';
  }

  const durationMs = Math.max(0, (endedAt ?? Date.now()) - startedAt);
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function matchesFilter(session, filter) {
  if (!session.started_at) {
    return true;
  }

  const sessionDate = new Date(session.started_at);
  const now = new Date();

  if (filter === 'Today') {
    return sessionDate.toDateString() === now.toDateString();
  }

  if (filter === 'This Week') {
    const startOfWeek = new Date(now);
    const dayOffset = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
    return sessionDate >= startOfWeek;
  }

  return sessionDate.getMonth() === now.getMonth()
    && sessionDate.getFullYear() === now.getFullYear();
}

function normalizeReadings(detail, stressCritical) {
  const readings = (detail.readings ?? []).map((reading) => ({
    id: reading.id,
    timestamp: asNumber(reading.timestamp),
    studentId: reading.student_id ?? '',
    heartRate: asNumber(reading.heart_rate),
    spo2: asNumber(reading.spo2),
    gsr: asNumber(reading.gsr),
    hrv: asNumber(reading.hrv),
    stressIndex: asNumber(reading.stress_index),
    ledState: reading.led_state ?? '',
  }));

  let previousStress = null;
  const spikes = [];

  readings.forEach((reading) => {
    if (
      reading.stressIndex !== null
      && reading.stressIndex >= stressCritical
      && (previousStress === null || previousStress < stressCritical)
    ) {
      spikes.push(reading.timestamp);
    }

    previousStress = reading.stressIndex;
  });

  return {
    ...detail,
    readings,
    spikes,
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

function downloadSessionCsv(session, detail) {
  const headers = ['timestamp', 'student_id', 'heart_rate', 'spo2', 'gsr', 'hrv', 'stress_index', 'led_state'];
  const rows = detail.readings.map((reading) => ([
    reading.timestamp ? new Date(reading.timestamp).toISOString() : '',
    reading.studentId,
    reading.heartRate,
    reading.spo2,
    reading.gsr,
    reading.hrv,
    reading.stressIndex,
    reading.ledState,
  ]));
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeStudent = session.student_id || 'session';

  link.href = url;
  link.download = `${safeStudent}-session-${session.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function History() {
  const { state } = useStress();
  const { isLoading: mlLoading, predictCsv } = useMLPrediction();
  const [mlBatchStatus, setMlBatchStatus] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('Today');
  const [detailsById, setDetailsById] = useState({});

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMlBatchStatus('Processing with Track A/B ML...');
    const result = await predictCsv(file);
    if (result.fallback) {
      setMlBatchStatus('Track_A_OFFLINE (Fallback Active)');
    } else {
      setMlBatchStatus(`Batch Complete. Detected: ${result.summary}`);
    }
    setTimeout(() => setMlBatchStatus(''), 4000);
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessions() {
      setLoading(true);
      setLoadError('');

      try {
        const response = await fetch(`http://${state.settings.serverIp}:3001/api/sessions`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Unable to load session summaries.');
        }

        const data = await response.json();
        setSessions(Array.isArray(data) ? data : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSessions([]);
          setLoadError('Unable to reach the BioPulse backend right now.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSessions();

    return () => controller.abort();
  }, [state.settings.serverIp]);

  const filteredSessions = sessions.filter((session) => matchesFilter(session, filter));
  const cardBg = 'linear-gradient(135deg, rgba(135,129,255,0.05) 0%, rgba(30,30,47,1) 100%)';

  const toggleSession = async (sessionId) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(sessionId);

    const existing = detailsById[sessionId];
    if (existing?.status === 'loaded' || existing?.status === 'loading') {
      return;
    }

    setDetailsById((current) => ({
      ...current,
      [sessionId]: { status: 'loading', data: null, error: '' },
    }));

    try {
      const response = await fetch(`http://${state.settings.serverIp}:3001/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Unable to load session detail.');
      }

      const detail = await response.json();
      setDetailsById((current) => ({
        ...current,
        [sessionId]: {
          status: 'loaded',
          data: normalizeReadings(detail, state.settings.stressCritical),
          error: '',
        },
      }));
    } catch {
      setDetailsById((current) => ({
        ...current,
        [sessionId]: {
          status: 'error',
          data: null,
          error: 'Session detail could not be loaded.',
        },
      }));
    }
  };

  return (
    <main style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 100, padding: '80px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(12,12,29,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(70,69,85,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
          <BioPulseLogo size="small" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(196,192,255,0.12)', borderRadius: 999, border: '1px solid rgba(196,192,255,0.24)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c4c0ff', display: 'block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#c4c0ff' }}>{sessions.length} Sessions</span>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: '#e3e0f8' }}>Session History</h2>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#29283a', borderRadius: 12, cursor: 'pointer', border: '1px solid #464555', transition: 'all 0.2s ease', opacity: mlLoading ? 0.6 : 1 }}>
          <Upload style={{ width: 14, height: 14, color: '#c4c0ff' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#c4c0ff' }}>{mlLoading ? 'Processing...' : 'Batch ML'}</span>
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} disabled={mlLoading} />
        </label>
      </div>

      {mlBatchStatus && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 12, color: '#c4c0ff', fontSize: 13, fontWeight: 500 }}>
          {mlBatchStatus}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, background: '#1a1a2b', borderRadius: 16, padding: 4, marginBottom: 20 }}>
        {FILTERS.map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              background: filter === option ? '#29283a' : 'transparent',
              color: filter === option ? '#c4c0ff' : '#c7c4d8',
              transition: 'all 0.2s ease',
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {loadError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)', color: '#ffb4ab', fontSize: 13 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          [1, 2, 3].map((item) => <SkeletonCard key={item} />)
        ) : filteredSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ margin: '0 auto 20px', display: 'block', opacity: 0.3 }}>
              <circle cx="40" cy="30" r="24" fill="none" stroke="#c4c0ff" strokeWidth="3" />
              <path d="M28 30 L34 24 L40 36 L46 20 L52 30" stroke="#c4c0ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M20 65 Q40 50 60 65" stroke="#c4c0ff" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <p style={{ color: '#918fa1', fontSize: 14 }}>No session history matches this filter yet.</p>
          </div>
        ) : filteredSessions.map((session) => {
          const avgStress = asNumber(session.avgStress);
          const peakStress = asNumber(session.peakStress);
          const readingCount = asNumber(session.readingCount) ?? 0;
          const stressMeta = getStressMeta(avgStress);
          const detailEntry = detailsById[session.id];
          const detail = detailEntry?.data;
          const isExpanded = expandedId === session.id;
          const canExport = detailEntry?.status === 'loaded' && detail?.readings?.length > 0;
          const peakTime = session.peakTimestamp ? formatTime(Number(session.peakTimestamp)) : '--:--';

          return (
            <article
              key={session.id}
              style={{
                background: cardBg,
                backdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(70,69,85,0.3)',
                borderLeft: peakStress !== null && peakStress >= 66 ? '4px solid rgba(239,68,68,0.5)' : 'none',
                borderRadius: 24,
                padding: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 2 }}>Session Date</div>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: '#e3e0f8' }}>{formatDate(Number(session.started_at))}</div>
                    <div style={{ fontSize: 13, color: '#c7c4d8' }}>{formatTime(Number(session.started_at))}</div>
                    <div style={{ fontSize: 11, color: '#918fa1', marginTop: 8 }}>Student {session.student_id || 'UNKNOWN'} · {readingCount} readings</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, textAlign: 'right' }}>Avg Stress</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: stressMeta.color }}>
                        {avgStress === null ? '--' : Math.round(avgStress)}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: `${stressMeta.color}22`, color: stressMeta.color, fontSize: 10, fontWeight: 700 }}>
                        {stressMeta.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 10, color: '#918fa1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Duration: </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#e3e0f8' }}>{formatDuration(Number(session.started_at), asNumber(session.ended_at))}</span>
                    <span style={{ fontSize: 10, color: '#918fa1', textTransform: 'uppercase', letterSpacing: '0.1em', marginLeft: 16 }}>Peak: </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#e3e0f8' }}>{peakTime}</span>
                  </div>

                  <button
                    onClick={() => toggleSession(session.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, background: '#29283a', border: 'none', color: '#c4c0ff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {isExpanded ? 'Hide' : 'Details'}
                    {isExpanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 200, borderRadius: 12, overflow: 'hidden', background: '#121222' }}>
                      {detailEntry?.status === 'loading' && (
                        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#918fa1', fontSize: 13 }}>
                          Loading session trace...
                        </div>
                      )}

                      {detailEntry?.status === 'error' && (
                        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#ffb4ab', fontSize: 13 }}>
                          {detailEntry.error}
                        </div>
                      )}

                      {detailEntry?.status === 'loaded' && (
                        <SessionChart data={detail.readings} spikes={detail.spikes} />
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '12px 16px', background: '#1a1a2b', borderRadius: 12 }}>
                      <span style={{ fontSize: 13, color: '#c7c4d8' }}>GSR + HR + Stress trace</span>
                      <button
                        onClick={() => canExport && downloadSessionCsv(session, detail)}
                        disabled={!canExport}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 14px',
                          borderRadius: 8,
                          background: canExport ? '#29283a' : 'rgba(70,69,85,0.35)',
                          border: 'none',
                          color: canExport ? '#c4c0ff' : '#918fa1',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: canExport ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Download style={{ width: 12, height: 12 }} /> CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
