// src/hooks/useMockData.js
// Replays real readings from /api/csv-session in order.
// Falls back to synthetic data if the backend is unreachable.

import { useEffect, useRef, useState } from 'react';
import { useStress } from '../context/useStress';

// ── Fetch CSV session once (module-level cache) ───────────────────
let _csvRows = null;
let _fetchPromise = null;

function loadCsvRows(serverIp) {
  if (_csvRows) return Promise.resolve(_csvRows);
  if (!_fetchPromise) {
    _fetchPromise = fetch(`http://${serverIp}:3001/api/csv-session`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        _csvRows = (data.rows ?? []).filter(Boolean);
        return _csvRows;
      })
      .catch(() => {
        _fetchPromise = null; // allow retry
        return [];
      });
  }
  return _fetchPromise;
}

// ── Synthetic fallback ────────────────────────────────────────────
function syntheticReading(tick) {
  let hr  = 75 + Math.sin(tick / 5) * 10 + (Math.random() * 5);
  let gsr = 4  + Math.sin(tick / 10) * 2 + (Math.random() * 1);
  let hrv = 60 + Math.sin(tick / 8) * 15 + (Math.random() * 5);
  if (tick % 15 === 0) { hr += 25; gsr += 3; hrv -= 20; }
  return {
    heartRate:   Math.round(Math.min(150, Math.max(50, hr))),
    gsr:         +Math.min(12, Math.max(1, gsr)).toFixed(2),
    hrv:         Math.round(Math.min(120, Math.max(20, hrv))),
    temperature: 27.5,
    humidity:    50.4,
  };
}

export function useMockData(enabled = true) {
  const { state, dispatch } = useStress();
  const tickRef    = useRef(0);
  const csvIdxRef  = useRef(0);
  const [rows, setRows] = useState([]);

  // Boot: load CSV session from backend
  useEffect(() => {
    if (!enabled) return;
    loadCsvRows(state.settings.serverIp || 'localhost').then(r => {
      if (r.length > 0) {
        setRows(r);
        csvIdxRef.current = 0;
      }
    });
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'mock' });
  }, [enabled, dispatch, state.settings.serverIp]);

  // Sensor reading loop
  useEffect(() => {
    if (!enabled || !state.sessionActive) return;

    const interval = setInterval(() => {
      tickRef.current += 1;

      let payload;
      if (rows.length > 0) {
        // Replay CSV row-by-row, cycling through
        const row = rows[csvIdxRef.current % rows.length];
        csvIdxRef.current += 1;
        payload = {
          heartRate:   row.heart_rate,
          gsr:         row.gsr,
          hrv:         row.hrv_filled ?? row.hrv ?? 0,
          temperature: row.temperature,
          humidity:    row.humidity,
          // Pass pre-computed stress so StressContext uses it directly
          stressIndex: row.stress_index ?? undefined,
        };
      } else {
        payload = syntheticReading(tickRef.current);
      }

      dispatch({ type: 'NEW_READING', source: 'mock', payload });
    }, state.settings.samplingRate);

    return () => clearInterval(interval);
  }, [enabled, state.sessionActive, state.settings.samplingRate, rows, dispatch]);

  // Duration timer loop (every 1 s)
  useEffect(() => {
    if (!enabled || !state.sessionActive) return;
    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIME', source: 'mock' });
    }, 1000);
    return () => clearInterval(timer);
  }, [dispatch, enabled, state.sessionActive]);
}
