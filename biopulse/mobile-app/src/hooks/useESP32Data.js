// src/hooks/useESP32Data.js
import { useEffect, useRef } from 'react';
import { useStress } from '../context/useStress';

export function useESP32Data(enabled = false) {
  const { state, dispatch } = useStress();
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    if (!enabled || !state.sessionActive) {
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let disposed = false;

    const closeSocket = () => {
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const connectWs = () => {
      if (disposed) {
        return;
      }

      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
      const ws = new WebSocket(`ws://${state.settings.serverIp}:3001/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }

        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.heartRate !== undefined) {
            dispatch({
              type: 'NEW_READING',
              source: 'live',
              payload: {
                heartRate: data.heartRate,
                spo2: data.spo2,
                gsr: data.gsr,
                hrv: data.hrv,
                stressIndex: data.stressIndex ?? null,
                timestamp: data.timestamp ?? Date.now(),
              },
            });
          }
        } catch (e) {
          console.error('Failed to parse websocket data', e);
        }
      };

      ws.onclose = () => {
        if (disposed) {
          return;
        }

        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
        reconnectRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
        ws.close();
      };
    };

    connectWs();

    return () => {
      disposed = true;
      closeSocket();
    };
  }, [dispatch, enabled, state.sessionActive, state.settings.serverIp]);

  // Duration timer (similar to mock)
  useEffect(() => {
    if (!enabled || !state.sessionActive || state.connectionStatus !== 'connected') {
      return;
    }

    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIME', source: 'live' });
    }, 1000);

    return () => clearInterval(timer);
  }, [dispatch, enabled, state.connectionStatus, state.sessionActive]);
}
