import React from 'react';
import { Activity, HeartPulse, Wifi, WifiOff, Wind, Zap } from 'lucide-react';
import { BioPulseLogo } from '../components/BioPulseLogo';
import { StressGauge } from '../components/StressGauge';
import { VitalsCard } from '../components/VitalsCard';
import { useStress } from '../context/useStress';
import { useMLPrediction } from '../hooks/useMLPrediction';

const S = {
  page: { minHeight: '100vh', paddingTop: 88, paddingBottom: 100, padding: '88px 16px 100px', maxWidth: 480, margin: '0 auto' },
  header: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
    background: 'rgba(12,12,29,0.85)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(70,69,85,0.15)',
    boxShadow: '0 0 20px rgba(108,99,255,0.1)',
  },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
    background: '#29283a', borderRadius: 999, border: '1px solid rgba(70,69,85,0.3)',
  },
  ledRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '8px 0' },
  sessionBar: {
    background: 'linear-gradient(135deg, rgba(135,129,255,0.05) 0%, rgba(30,30,47,1) 100%)',
    borderRadius: 16, padding: '20px 16px',
    borderTop: '1px solid rgba(70,69,85,0.25)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  sessionItem: { padding: '0 12px', textAlign: 'center' },
};

function getConnectionMeta(dataSource, connectionStatus, hasReceivedLiveData) {
  if (dataSource === 'mock') {
    return {
      label: 'MOCK STREAM',
      description: 'Streaming simulated sensor data locally.',
      color: '#c4c0ff',
      Icon: Activity,
    };
  }

  if (connectionStatus === 'connected') {
    return {
      label: 'LIVE SENSOR',
      description: 'ESP32 WebSocket connected.',
      color: '#10B981',
      Icon: Wifi,
    };
  }

  if (connectionStatus === 'connecting') {
    return {
      label: 'CONNECTING',
      description: 'Trying to reach the configured sensor gateway.',
      color: '#F59E0B',
      Icon: Wifi,
    };
  }

  if (connectionStatus === 'error') {
    return {
      label: 'SOCKET ERROR',
      description: 'The live link hit an unexpected transport error.',
      color: '#EF4444',
      Icon: WifiOff,
    };
  }

  return {
    label: hasReceivedLiveData ? 'OFFLINE' : 'WAITING FOR DATA',
    description: hasReceivedLiveData
      ? 'Showing the last real reading until the live link returns.'
      : 'No live packet has been received yet.',
    color: hasReceivedLiveData ? '#918fa1' : '#adc6ff',
    Icon: WifiOff,
  };
}

export function LiveMonitor() {
  const { state } = useStress();
  const { mlResult, predictLive } = useMLPrediction();
  const { liveData, historyLine, startTime, elapsedSeconds, spikeCount, dataSource, connectionStatus, hasReceivedLiveData, hasReading } = state;
  
  React.useEffect(() => {
    if (dataSource === 'live' && hasReceivedLiveData && liveData) {
      // Throttle or pass entirely to hook
      predictLive(liveData);
    }
  }, [liveData, dataSource, hasReceivedLiveData, predictLive]);

  const connectionMeta = getConnectionMeta(dataSource, connectionStatus, hasReceivedLiveData);
  const lastPoint = historyLine[historyLine.length - 1];
  const showCriticalFlash = lastPoint?.stressIndex !== null && lastPoint?.stressIndex > 85;

  const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(elapsedSeconds % 60).padStart(2, '0');
  const startStr = startTime ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const durationLabel = startTime ? `${mins}:${secs}` : '--:--';
  const stressIndex = liveData.stressIndex;
  const isCalm = stressIndex !== null && stressIndex <= 35;
  const isAlert = stressIndex !== null && stressIndex > 35 && stressIndex <= 85;
  const isStress = stressIndex !== null && stressIndex > 85;
  const headerLabel = dataSource === 'mock' ? 'Mock Session Active' : 'Sensor Session Active';
  const helperText = dataSource === 'live' && !hasReceivedLiveData
    ? 'Awaiting the first ESP32 reading on the live socket.'
    : connectionMeta.description;

  const ledActive = (active, color, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: active ? 1 : 0.3, filter: active ? 'none' : 'grayscale(1)', transition: 'all 0.5s ease' }}>
      <div
        style={{
          width: '100%', height: 6, borderRadius: 99,
          background: active ? color : '#464555',
          boxShadow: active ? `0 0 14px ${color}99` : 'none',
          transition: 'all 0.5s ease',
        }}
        className={active ? 'animate-pulse-slow' : ''}
      />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: active ? color : '#918fa1' }}>{label}</span>
    </div>
  );

  return (
    <main style={S.page}>
      {showCriticalFlash && (
        <div key={lastPoint.timestamp} style={{ position: 'fixed', inset: 0, background: 'rgba(239,68,68,0.22)', zIndex: 99, pointerEvents: 'none', animation: 'pulse-slow 1.5s ease-out' }} />
      )}

      <header style={S.header}>
        <div style={S.headerRow}>
          <BioPulseLogo size="small" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#c7c4d8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{headerLabel}</span>
            <div style={S.liveBadge}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: connectionMeta.color, display: 'block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#e3e0f8', letterSpacing: '-0.01em' }}>{connectionMeta.label}</span>
            </div>
          </div>
        </div>
      </header>

      <section style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 18, background: 'rgba(18,18,34,0.9)', border: `1px solid ${connectionMeta.color}33`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <connectionMeta.Icon style={{ width: 18, height: 18, color: connectionMeta.color, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: connectionMeta.color, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>{connectionMeta.label}</p>
          <p style={{ fontSize: 13, color: '#c7c4d8' }}>{helperText}</p>
        </div>
      </section>

      <section
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px 0',
          background: 'radial-gradient(circle at center, rgba(108,99,255,0.07) 0%, transparent 70%)',
          borderRadius: 24,
        }}
      >
        <StressGauge
          stressIndex={liveData.stressIndex}
          label={liveData.label?.label ?? 'WAITING'}
          color={liveData.label?.color ?? '#918fa1'}
        />
        {mlResult && !mlResult.fallback && (
          <div style={{ marginTop: 20, padding: '4px 12px', background: 'rgba(108,99,255,0.1)', borderRadius: 12, border: '1px solid rgba(108,99,255,0.3)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#c4c0ff', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>ML Engine</span>
            <span style={{ fontSize: 13, color: '#e3e0f8', fontWeight: 600 }}>{mlResult.stress_label} ({Math.round((mlResult.confidence || 0) * 100)}%)</span>
          </div>
        )}
      </section>

      <div style={S.ledRow}>
        {ledActive(isCalm, '#10B981', 'Calm')}
        {ledActive(isAlert, '#F59E0B', 'Alert')}
        {ledActive(isStress, '#EF4444', 'Stressed')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        <VitalsCard
          icon={HeartPulse}
          label="BPM"
          value={liveData.heartRate ?? '--'}
          colorHex="#c4c0ff"
          bgColorHex="rgba(196,192,255,0.1)"
          status={liveData.heartRate === null ? 'Waiting' : (liveData.heartRate > state.settings.hrLimit ? 'High' : 'Stable')}
          sparklineData={historyLine.map((reading) => reading.heartRate).filter((value) => value !== null)}
        />
        <VitalsCard
          icon={Wind}
          label="SpO2"
          value={liveData.spo2 === null ? '--' : `${liveData.spo2}%`}
          colorHex="#adc6ff"
          bgColorHex="rgba(173,198,255,0.1)"
          status={liveData.spo2 === null ? 'Waiting' : 'Optimal'}
          sparklineData={historyLine.map((reading) => reading.spo2).filter((value) => value !== null)}
        />
        <VitalsCard
          icon={Zap}
          label="GSR"
          value={liveData.gsr ?? '--'}
          unit="µS"
          colorHex="#ffb785"
          bgColorHex="rgba(255,183,133,0.1)"
          status={liveData.gsr === null ? 'Waiting' : 'Tracking'}
          sparklineData={historyLine.map((reading) => reading.gsr).filter((value) => value !== null)}
        />
        <VitalsCard
          icon={Activity}
          label="HRV"
          value={liveData.hrv ?? '--'}
          unit="ms"
          colorHex="#c4c0ff"
          bgColorHex="rgba(196,192,255,0.1)"
          status={liveData.hrv === null ? 'Waiting' : 'Tracking'}
          sparklineData={historyLine.map((reading) => reading.hrv).filter((value) => value !== null)}
        />
      </div>

      <div style={S.sessionBar}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'center' }}>
          <div style={S.sessionItem}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#c7c4d8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Start Time</p>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 500, color: '#e3e0f8' }}>{startStr}</p>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(70,69,85,0.25)', margin: '0 auto' }} />
          <div style={S.sessionItem}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#c7c4d8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Duration</p>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 500, color: '#c4c0ff', letterSpacing: '-0.02em' }}>{durationLabel}</p>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(70,69,85,0.25)', margin: '0 auto' }} />
          <div style={S.sessionItem}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#c7c4d8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Spikes</p>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: '#EF4444' }}>{hasReading ? spikeCount : '--'}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
