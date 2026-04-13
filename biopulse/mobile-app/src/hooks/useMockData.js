// src/hooks/useMockData.js
import { useEffect, useRef } from 'react';
import { useStress } from '../context/useStress';

export function useMockData(enabled = true) {
  const { state, dispatch } = useStress();
  const tickRef = useRef(0);

  useEffect(() => {
    if (enabled) {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'mock' });
    }
  }, [dispatch, enabled]);

  // Sensor reading loop
  useEffect(() => {
    if (!enabled || !state.sessionActive) return;

    const interval = setInterval(() => {
      tickRef.current += 1;
      
      let hr = 75 + Math.sin(tickRef.current / 5) * 10 + (Math.random() * 5);
      let gsr = 4 + Math.sin(tickRef.current / 10) * 2 + (Math.random() * 1);
      let spo2 = 96 + Math.floor(Math.random() * 4);
      let hrv = 60 + Math.sin(tickRef.current / 8) * 15 + (Math.random() * 5);
      
      // Occasionally spike stress (every ~15 readings)
      if (tickRef.current % 15 === 0) {
        hr += 30; // Spike HR
        gsr += 10; // Spike GSR
        hrv -= 30; // Drop HRV
      }

      dispatch({
        type: 'NEW_READING',
        source: 'mock',
        payload: {
          heartRate: Math.round(Math.min(110, Math.max(55, hr))),
          spo2: Math.round(Math.min(100, Math.max(94, spo2))),
          gsr: Number(Math.min(20, Math.max(2, gsr)).toFixed(1)),
          hrv: Math.round(Math.min(100, Math.max(20, hrv)))
        }
      });
      
    }, state.settings.samplingRate);

    return () => clearInterval(interval);
  }, [enabled, state.sessionActive, state.settings.samplingRate, dispatch]);

  // Duration timer loop (every 1s)
  useEffect(() => {
    if (!enabled || !state.sessionActive) return;

    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIME', source: 'mock' });
    }, 1000);

    return () => clearInterval(timer);
  }, [dispatch, enabled, state.sessionActive]);
}
