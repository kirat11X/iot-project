// src/utils/stressAlgorithm.js

const normalize = (val, min, max) =>
  Math.min(1, Math.max(0, (val - min) / (max - min)));

export function computeStressIndex({ heartRate, gsr, hrv }) {
  const hrNorm  = normalize(heartRate, 55, 110);
  const gsrNorm = normalize(gsr, 2, 20);
  const hrvInv  = 1 - normalize(hrv, 20, 100);
  const stress  = (0.35 * hrNorm) + (0.45 * gsrNorm) + (0.20 * hrvInv);
  return Math.round(stress * 100);
}

export function getStressLabel(index) {
  if (index <= 35) return { label: 'CALM',     color: '#10B981', led: 'green'  };
  if (index <= 65) return { label: 'MODERATE', color: '#F59E0B', led: 'yellow' };
  if (index <= 85) return { label: 'STRESSED', color: '#EF4444', led: 'red'    };
  return             { label: 'CRITICAL',  color: '#EF4444', led: 'blink'  };
}
