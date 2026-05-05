// src/utils/stressAlgorithm.js
// Updated to match actual CSV data ranges:
//   heart_rate: 40–200 BPM  (filtered; ≤200 by design)
//   gsr:        0–12 %      (your sensor's native 0–10% range, peak ~10%)
//   hrv:        5–200 ms    (RMSSD; currently 0 in this session → median-filled)

const normalize = (val, min, max) =>
  Math.min(1, Math.max(0, (val - min) / (max - min)));

/**
 * Primary stress formula for live/processed data.
 * gsr is expected in 0–12 % (your sensor's native unit).
 */
export function computeStressIndex({ heartRate, gsr, hrv }) {
  const hrNorm  = normalize(heartRate, 40, 200);
  // GSR range in your data: 0–12 %
  const gsrNorm = normalize(gsr, 0, 12);
  const hrvInv  = 1 - normalize(hrv, 5, 200);
  const stress  = (0.35 * hrNorm) + (0.45 * gsrNorm) + (0.20 * hrvInv);
  return Math.round(stress * 100);
}

/**
 * Fallback when sensor is in raw-ADC mode (no peak detection on ESP32 yet).
 */
export function computeAnalogStressIndex({ rawHeartRate, gsrPercentage }) {
  const hrSignal  = normalize(rawHeartRate, 0, 4095);
  const gsrSignal = normalize(gsrPercentage, 0, 12);
  const stress = (0.40 * hrSignal) + (0.60 * gsrSignal);
  return Math.round(stress * 100);
}

export function getStressLabel(index) {
  if (index <= 35) return { label: 'CALM',     color: '#10B981', led: 'green'  };
  if (index <= 65) return { label: 'MODERATE', color: '#F59E0B', led: 'yellow' };
  if (index <= 85) return { label: 'STRESSED', color: '#EF4444', led: 'red'    };
  return             { label: 'CRITICAL',  color: '#EF4444', led: 'blink'  };
}
