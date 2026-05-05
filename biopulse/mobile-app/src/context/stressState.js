import { computeAnalogStressIndex, computeStressIndex, getStressLabel } from '../utils/stressAlgorithm';

export const PREFERENCES_STORAGE_KEY = 'biopulse_preferences';
export const PROFILE_STORAGE_KEY = 'biopulse_profile';
export const DEFAULT_DATA_SOURCE = 'live';
export const DEFAULT_SETTINGS = {
  serverIp: 'localhost',
  gsrTrigger: 8.5,
  hrLimit: 110,
  stressCritical: 75,
  samplingRate: 1000,
};

const WAITING_LABEL = { label: 'WAITING', color: '#918fa1', led: 'offline' };
const LABEL_META = {
  CALM: { label: 'CALM', color: '#10B981', led: 'green' },
  MODERATE: { label: 'MODERATE', color: '#F59E0B', led: 'yellow' },
  STRESSED: { label: 'STRESSED', color: '#EF4444', led: 'red' },
  CRITICAL: { label: 'CRITICAL', color: '#EF4444', led: 'blink' },
};

function getLabelMeta(stressLabel, stressIndex) {
  if (stressLabel && LABEL_META[stressLabel]) {
    return LABEL_META[stressLabel];
  }

  if (stressIndex === null || stressIndex === undefined) {
    return WAITING_LABEL;
  }

  return getStressLabel(stressIndex);
}

export function createEmptyReading() {
  return {
    heartRate: null,
    gsr: null,
    hrv: null,
    temperature: null,
    humidity: null,
    stressIndex: null,
    mlStressIndex: null,
    mlStressLabel: null,
    mlConfidence: null,
    sensorMode: null,
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
  const gsr = payload.gsr ?? null;
  const hrv = payload.hrv ?? null;
  const temperature = payload.temperature ?? null;
  const humidity = payload.humidity ?? null;
  const sensorMode = payload.sensorMode ?? null;
  const timestamp = payload.timestamp ?? Date.now();
  const canComputeStress = heartRate !== null && gsr !== null && hrv !== null;
  const canComputeAnalogStress = sensorMode === 'analog_adc' && heartRate !== null && gsr !== null;
  const derivedStressIndex = payload.stressIndex ?? (canComputeStress
    ? computeStressIndex({ heartRate, gsr, hrv })
    : canComputeAnalogStress
      ? computeAnalogStressIndex({ rawHeartRate: heartRate, gsrPercentage: gsr })
      : null);
  const mlStressIndex = payload.mlStressIndex ?? null;
  const mlStressLabel = payload.mlStressLabel ?? null;
  const mlConfidence = payload.mlConfidence ?? null;
  const stressIndex = mlStressIndex ?? derivedStressIndex;
  const label = getLabelMeta(mlStressLabel, stressIndex);
  const historyReading = {
    heartRate,
    gsr,
    hrv,
    temperature,
    humidity,
    stressIndex,
    mlStressIndex,
    mlStressLabel,
    mlConfidence,
    sensorMode,
    label,
    timestamp,
  };
  const liveData = {
    ...historyReading,
    mlStressIndex: mlStressIndex ?? snapshot.liveData.mlStressIndex ?? null,
    mlStressLabel: mlStressLabel ?? snapshot.liveData.mlStressLabel ?? null,
    mlConfidence: mlConfidence ?? snapshot.liveData.mlConfidence ?? null,
  };
  const previousStress = snapshot.liveData.stressIndex;
  const crossedCritical = stressIndex !== null
    && stressIndex >= settings.stressCritical
    && (previousStress === null || previousStress < settings.stressCritical);

  return {
    startTime: snapshot.startTime ?? timestamp,
    elapsedSeconds: snapshot.elapsedSeconds,
    spikeCount: crossedCritical ? snapshot.spikeCount + 1 : snapshot.spikeCount,
    historyLine: [...snapshot.historyLine, historyReading].slice(-30),
    liveData,
    hasReading: true,
  };
}

/**
 * Overlay a ML_RESULT onto the current snapshot.
 * - Updates stressIndex and label from the ML model output
 * - Updates hrv to the server-computed RMSSD value
 * - Does NOT add a new history point (it's not a new reading)
 */
export function applyMlResult(snapshot, payload) {
  const { stressIndex, stressLabel, confidence, hrv } = payload;
  if (stressIndex == null || !snapshot.hasReading) return snapshot;

  const label = getLabelMeta(stressLabel, stressIndex);

  const updatedLiveData = {
    ...snapshot.liveData,
    stressIndex,
    label,
    mlStressIndex: stressIndex,
    mlStressLabel: label.label,
    // Use ML-computed RMSSD HRV when available and non-zero
    hrv: (hrv != null && hrv > 0) ? hrv : snapshot.liveData.hrv,
    mlConfidence: confidence,
  };

  // Also patch the last history point so charts reflect the ML value
  const historyLine = snapshot.historyLine.length > 0
    ? [
        ...snapshot.historyLine.slice(0, -1),
        {
          ...snapshot.historyLine[snapshot.historyLine.length - 1],
          stressIndex,
          label,
          mlStressIndex: stressIndex,
          mlStressLabel: label.label,
          mlConfidence: confidence,
        },
      ]
    : snapshot.historyLine;

  return { ...snapshot, liveData: updatedLiveData, historyLine };
}
