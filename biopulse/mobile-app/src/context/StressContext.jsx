import React, { useEffect, useReducer } from 'react';
import { StressContext } from './stressContext';
import {
  PREFERENCES_STORAGE_KEY,
  applySensorReading,
  createInitialState,
  createSessionState,
  getCurrentSessionSnapshot,
  mergeSavedPreferences,
} from './stressState';

function switchDataSource(state, dataSource) {
  if (dataSource === 'live') {
    const liveView = state.hasReceivedLiveData ? state.liveSnapshot : createSessionState();
    return {
      ...state,
      dataSource: 'live',
      connectionStatus: 'disconnected',
      ...liveView,
    };
  }

  return {
    ...state,
    dataSource: 'mock',
    connectionStatus: 'mock',
    ...createSessionState({ startTime: Date.now() }),
  };
}

function stressReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_PREFERENCES': {
      const { dataSource, settings } = mergeSavedPreferences(action.payload);
      return switchDataSource({ ...state, settings }, dataSource);
    }
    case 'SET_DATA_SOURCE':
      return switchDataSource(state, action.payload);
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    case 'NEW_READING': {
      const source = action.source ?? state.dataSource;

      if (source === 'live') {
        const liveSnapshot = applySensorReading(state.liveSnapshot, action.payload, state.settings);
        const nextState = {
          ...state,
          liveSnapshot,
          hasReceivedLiveData: true,
          connectionStatus: 'connected',
        };

        return state.dataSource === 'live'
          ? { ...nextState, ...liveSnapshot }
          : nextState;
      }

      if (state.dataSource !== 'mock') {
        return state;
      }

      return {
        ...state,
        ...applySensorReading(getCurrentSessionSnapshot(state), action.payload, state.settings),
      };
    }
    case 'TICK_TIME': {
      const source = action.source ?? state.dataSource;

      if (source === 'live') {
        if (!state.hasReceivedLiveData) {
          return state;
        }

        const liveSnapshot = {
          ...state.liveSnapshot,
          elapsedSeconds: state.liveSnapshot.elapsedSeconds + 1,
        };

        return state.dataSource === 'live'
          ? { ...state, liveSnapshot, elapsedSeconds: liveSnapshot.elapsedSeconds }
          : { ...state, liveSnapshot };
      }

      if (state.dataSource !== 'mock') {
        return state;
      }

      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    }
    case 'RESET_APP_STATE':
      return createInitialState();
    default:
      return state;
  }
}

export function StressProvider({ children }) {
  const [state, dispatch] = useReducer(stressReducer, undefined, createInitialState);

  useEffect(() => {
    const savedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (savedPreferences) {
      dispatch({ type: 'HYDRATE_PREFERENCES', payload: JSON.parse(savedPreferences) });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
      dataSource: state.dataSource,
      settings: state.settings,
    }));
  }, [state.dataSource, state.settings]);

  return (
    <StressContext.Provider value={{ state, dispatch }}>
      {children}
    </StressContext.Provider>
  );
}
