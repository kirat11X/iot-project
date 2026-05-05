import React, { useState } from 'react';
import { AlertCircle, Trash2, User, Wifi, WifiOff } from 'lucide-react';
import { BioPulseLogo } from '../components/BioPulseLogo';
import { useStress } from '../context/useStress';
import { PROFILE_STORAGE_KEY, PREFERENCES_STORAGE_KEY } from '../context/stressState';

const EMPTY_PROFILE = { name: '', studentId: '', className: '' };

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)) || EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

function getConnectionStatus(state) {
  if (state.dataSource === 'mock') {
    return {
      label: 'Mock Stream',
      description: 'The app is using built-in demo telemetry.',
      color: '#c4c0ff',
      Icon: Wifi,
    };
  }

  if (state.connectionStatus === 'connected') {
    return {
      label: 'Live Connected',
      description: `Receiving real data from ${state.settings.serverIp}.`,
      color: '#10B981',
      Icon: Wifi,
    };
  }

  if (state.connectionStatus === 'connecting') {
    return {
      label: 'Connecting',
      description: `Trying ws://${state.settings.serverIp}:3001/live`,
      color: '#F59E0B',
      Icon: Wifi,
    };
  }

  if (state.connectionStatus === 'error') {
    return {
      label: 'Socket Error',
      description: 'The last live connection attempt failed at the transport layer.',
      color: '#EF4444',
      Icon: WifiOff,
    };
  }

  return {
    label: state.hasReceivedLiveData ? 'Offline' : 'Waiting for Data',
    description: state.hasReceivedLiveData
      ? 'The live link is down, but the last real reading is still visible.'
      : 'Live mode is selected, but no ESP32 reading has arrived yet.',
    color: state.hasReceivedLiveData ? '#918fa1' : '#adc6ff',
    Icon: WifiOff,
  };
}

export function Settings() {
  const { state, dispatch } = useStress();
  const { settings } = state;
  const [profile, setProfile] = useState(loadProfile);
  const [showWipe, setShowWipe] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const connectionMeta = getConnectionStatus(state);

  const updateSetting = (key, value) => dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });

  const saveProfile = (key, value) => {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSwitchToMock = () => {
    dispatch({ type: 'SET_DATA_SOURCE', payload: 'mock' });
    setStatusMessage('Mock stream enabled.');
    setResetError('');
  };

  const handleConnect = () => {
    dispatch({ type: 'SET_DATA_SOURCE', payload: 'live' });
    setStatusMessage(`Connecting to ${settings.serverIp}...`);
    setResetError('');
  };

  const handleWipe = async () => {
    setResetting(true);
    setResetError('');

    try {
      const response = await fetch(`http://${settings.serverIp}:3001/api/sessions`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Full reset failed.');
      }

      localStorage.removeItem(PROFILE_STORAGE_KEY);
      localStorage.removeItem(PREFERENCES_STORAGE_KEY);
      setProfile(EMPTY_PROFILE);
      dispatch({ type: 'RESET_APP_STATE' });
      setStatusMessage('BioPulse was fully reset to its default state.');
      setShowWipe(false);
    } catch {
      setResetError('Full reset could not reach the backend, so data was not cleared.');
    } finally {
      setResetting(false);
    }
  };

  const cardBg = 'linear-gradient(135deg, rgba(135,129,255,0.05) 0%, rgba(30,30,47,1) 100%)';
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#0c0c1d', border: '1px solid rgba(70,69,85,0.4)',
    borderRadius: 12, padding: '12px 16px', color: '#e3e0f8', fontSize: 14,
    outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s',
  };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 };
  const sliderLabel = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };

  return (
    <main style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 100, padding: '80px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      {showWipe && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a2b', borderRadius: 20, padding: 28, border: '1px solid rgba(239,68,68,0.3)', maxWidth: 320 }}>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: '#e3e0f8', marginBottom: 12 }}>Confirm Full Reset</h3>
            <p style={{ fontSize: 14, color: '#c7c4d8', marginBottom: 12, lineHeight: 1.6 }}>
              This clears backend sessions/readings and resets local profile, settings, and source selection.
            </p>
            {resetError && <p style={{ fontSize: 12, color: '#ffb4ab', marginBottom: 18 }}>{resetError}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowWipe(false)} disabled={resetting} style={{ flex: 1, padding: '10px 0', borderRadius: 12, background: '#29283a', border: 'none', color: '#e3e0f8', fontSize: 14, cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1 }}>Cancel</button>
              <button onClick={handleWipe} disabled={resetting} style={{ flex: 1, padding: '10px 0', borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1 }}>
                {resetting ? 'Resetting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(12,12,29,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(70,69,85,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
          <BioPulseLogo size="small" />
        </div>
      </header>

      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: '#e3e0f8', marginBottom: 4 }}>System Settings</h2>
      <p style={{ fontSize: 13, color: '#918fa1', marginBottom: 24 }}>Configure biometric acquisition parameters.</p>

      <div style={{ background: cardBg, borderRadius: 20, padding: 20, borderTop: '1px solid rgba(70,69,85,0.3)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Wifi style={{ color: '#c4c0ff', width: 16, height: 16 }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: '#e3e0f8' }}>ESP32 Connection</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { value: 'mock', label: 'Mock Stream' },
            { value: 'live', label: 'Live Socket' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={option.value === 'mock' ? handleSwitchToMock : handleConnect}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 12,
                border: state.dataSource === option.value ? '1px solid rgba(196,192,255,0.4)' : '1px solid rgba(70,69,85,0.25)',
                background: state.dataSource === option.value ? '#29283a' : '#0c0c1d',
                color: state.dataSource === option.value ? '#c4c0ff' : '#c7c4d8',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input
            value={settings.serverIp}
            onChange={(event) => updateSetting('serverIp', event.target.value)}
            placeholder="192.168.1.100 or localhost"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleConnect}
            style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(196,192,255,0.15)', border: '1px solid rgba(196,192,255,0.3)', color: '#c4c0ff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {state.dataSource === 'live' ? 'Reconnect' : 'Go Live'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(12,12,29,0.8)', border: `1px solid ${connectionMeta.color}33` }}>
          <connectionMeta.Icon style={{ color: connectionMeta.color, width: 16, height: 16, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: connectionMeta.color, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>{connectionMeta.label}</div>
            <div style={{ fontSize: 13, color: '#c7c4d8' }}>{statusMessage || connectionMeta.description}</div>
          </div>
        </div>
      </div>

      <div style={{ background: cardBg, borderRadius: 20, padding: 20, borderTop: '1px solid rgba(70,69,85,0.3)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <User style={{ color: '#adc6ff', width: 16, height: 16 }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: '#e3e0f8' }}>Student Profile</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['name', 'Full Name', 'text'], ['studentId', 'Student ID', 'text'], ['className', 'Class / Group', 'text']].map(([key, label, type]) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input type={type} value={profile[key]} onChange={(event) => saveProfile(key, event.target.value)} style={inputStyle} placeholder={label} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: cardBg, borderRadius: 20, padding: 20, borderTop: '1px solid rgba(70,69,85,0.3)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <AlertCircle style={{ color: '#EF4444', width: 16, height: 16 }} />
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: '#e3e0f8' }}>Alert Thresholds</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { key: 'gsrTrigger', label: 'GSR Spike Trigger', min: 0, max: 20, step: 0.1, unit: 'µS' },
            { key: 'hrLimit', label: 'HR Elevation Limit', min: 40, max: 180, step: 1, unit: 'BPM' },
            { key: 'stressCritical', label: 'Stress Index Criticality', min: 0, max: 100, step: 1, unit: '%' },
          ].map(({ key, label, min, max, step, unit }) => (
            <div key={key}>
              <div style={sliderLabel}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#e3e0f8' }}>{label}</label>
                <span style={{ fontSize: 12, fontFamily: 'monospace', background: '#29283a', padding: '3px 10px', borderRadius: 8, border: '1px solid rgba(70,69,85,0.3)', color: '#e3e0f8' }}>
                  {settings[key]} {unit}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={(event) => updateSetting(key, parseFloat(event.target.value))}
                style={{ width: '100%', accentColor: '#c4c0ff', cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: cardBg, borderRadius: 20, padding: 20, borderTop: '1px solid rgba(70,69,85,0.3)', marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Sampling Rate</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[{ val: 1000, label: 'Precision — 1s' }, { val: 2000, label: 'Balanced — 2s' }, { val: 5000, label: 'Power Save — 5s' }].map((option) => (
            <button
              key={option.val}
              onClick={() => updateSetting('samplingRate', option.val)}
              style={{
                display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
                borderRadius: 12, border: settings.samplingRate === option.val ? '2px solid #adc6ff' : '1px solid rgba(70,69,85,0.25)',
                background: settings.samplingRate === option.val ? '#1e1e2f' : '#0c0c1d',
                boxShadow: settings.samplingRate === option.val ? '0 0 12px rgba(173,198,255,0.2)' : 'none',
                color: settings.samplingRate === option.val ? '#adc6ff' : '#c7c4d8',
                fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: cardBg, borderRadius: 20, padding: 20, borderTop: '1px solid rgba(70,69,85,0.3)', marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#918fa1', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Data & Privacy</span>
        {resetError && <p style={{ fontSize: 12, color: '#ffb4ab', marginBottom: 12 }}>{resetError}</p>}
        <button
          onClick={() => setShowWipe(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
            borderRadius: 12, background: '#0c0c1d', border: '1px solid rgba(70,69,85,0.25)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Trash2 style={{ color: '#EF4444', width: 16, height: 16 }} />
          <span style={{ color: '#EF4444', fontSize: 14, fontWeight: 500 }}>Clear All Data</span>
        </button>
      </div>

      <div style={{ padding: '20px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: '#464555', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>BioPulse v1.0.0</p>
        <p style={{ fontSize: 11, color: '#464555' }}>ESP32 WROOM-32 · GSR-302 · MAX30102</p>
      </div>
    </main>
  );
}
