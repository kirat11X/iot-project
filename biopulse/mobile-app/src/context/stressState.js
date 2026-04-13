import { computeStressIndex, getStressLabel } from '../utils/stressAlgorithm';

export const PREFERENCES_STORAGE_KEY = 'biopulse_preferences';
export const PROFILE_STORAGE_KEY = 'biopulse_profile';
export const DEFAULT_DATA_SOURCE = 'mock';
export const DEFAULT_SETTINGS = {
  serverIp: 'localhost',
  gsrTrigger: 8.5,
  hrLimit: 110,
  stressCritical: 75,
  samplingRate: 1000,
};

const WAITING_LABEL = { label: 'WAITING', color: '#918fa1', led: 'offline' };

export function createEmptyReading() {
  return {
    heartRate: null,
    spo2: null,
    gsr: null,
    hrv: null,
    stressIndex: null,
    label: WAITING_LABEL,
    timestamp: null,
  };
}

export function createSessionState({ startTime = null } = {}) {
  return {
    startTime,
    elapsedSeconds: 0,
    spikeCount: 0,
    historyLine: [],
    liveData: createEmptyReading(),
    hasReading: false,
  };
}

export function createInitialState() {
  return {
    sessionActive: true,
    dataSource: DEFAULT_DATA_SOURCE,
    connectionStatus: 'mock',
    settings: { ...DEFAULT_SETTINGS },
    hasReceivedLiveData: false,
    liveSnapshot: createSessionState(),
    ...createSessionState({ startTime: Date.now() }),
  };
}

export function mergeSavedPreferences(savedPreferences = {}) {
  return {
    dataSource: savedPreferences.dataSource === 'live' ? 'live' : DEFAULT_DATA_SOURCE,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(savedPreferences.settings ?? {}),
    },
  };
}

export function toPersistedPreferences(state) {
  return {
    dataSource: state.dataSource,
    settings: state.settings,
  };
}

export function getCurrentSessionSnapshot(state) {
  return {
    startTime: state.startTime,
    elapsedSeconds: state.elapsedSeconds,
    spikeCount: state.spikeCount,
    historyLine: state.historyLine,
    liveData: state.liveData,
    hasReading: state.hasReading,
  };
}

export function applySensorReading(snapshot, payload, settings) {
  const heartRate = payload.heartRate ?? null;
  const spo2 = payload.spo2 ?? null;
  const gsr = payload.gsr ?? null;
  const hrv = payload.hrv ?? null;
  const timestamp = payload.timestamp ?? Date.now();
  const canComputeStress = heartRate !== null && gsr !== null && hrv !== null;
  const stressIndex = payload.stressIndex ?? (canComputeStress
    ? computeStressIndex({ heartRate, gsr, hrv })
    : null);
  const label = stressIndex === null ? WAITING_LABEL : getStressLabel(stressIndex);
  const reading = {
    heartRate,
    spo2,
    gsr,
    hrv,
    stressIndex,
    label,
    timestamp,
  };
  const previousStress = snapshot.liveData.stressIndex;
  const crossedCritical = stressIndex !== null
    && stressIndex >= settings.stressCritical
    && (previousStress === null || previousStress < settings.stressCritical);

  return {
    startTime: snapshot.startTime ?? timestamp,
    elapsedSeconds: snapshot.elapsedSeconds,
    spikeCount: crossedCritical ? snapshot.spikeCount + 1 : snapshot.spikeCount,
    historyLine: [...snapshot.historyLine, reading].slice(-30),
    liveData: reading,
    hasReading: true,
  };
}
