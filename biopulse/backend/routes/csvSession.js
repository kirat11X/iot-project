// routes/csvSession.js
// Parses readings.csv, filters noise, computes all ML engineered features,
// and returns processed rows + session averages.

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const CSV_PATH = path.join(__dirname, '../db/readings.csv');

// ── Rolling-window helpers ────────────────────────────────────────
function rollingMean(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v !== null && !isNaN(v));
    return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : null;
  });
}

function rollingStd(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v !== null && !isNaN(v));
    if (slice.length < 2) return 0;
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
    return Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
  });
}

function rollingMax(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v !== null && !isNaN(v));
    return slice.length ? Math.max(...slice) : null;
  });
}

function rollingSum(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v !== null && !isNaN(v));
    return slice.reduce((s, v) => s + v, 0);
  });
}

function diff(arr) {
  return arr.map((v, i) => (i === 0 ? 0 : v - arr[i - 1]));
}

function inferWindowSize(rows, windowSeconds = 30) {
  if (!rows || rows.length < 2) return 15;

  const diffs = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].timestamp;
    const curr = rows[i].timestamp;
    if (!isNaN(prev) && !isNaN(curr)) {
      const d = curr - prev;
      if (d > 0) diffs.push(d);
    }
  }

  if (diffs.length === 0) return 15;

  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  const sampleSeconds = median > 10 ? (median / 1000) : median;
  const safeSampleSeconds = sampleSeconds > 0 ? sampleSeconds : 2;
  return Math.max(Math.round(windowSeconds / safeSampleSeconds), 5);
}

// ── Parse CSV text ────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i].trim() : ''; });
    return obj;
  });
}

function avg(arr) {
  const valid = arr.filter(v => v !== null && !isNaN(v));
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function normalize(v, lo, hi) { return clamp((v - lo) / (hi - lo), 0, 1); }

// ── Main processing ───────────────────────────────────────────────
function processSession(rawRows) {
  // 1. Parse & basic filter
  let rows = rawRows.map(r => ({
    id:          parseInt(r.id, 10)         || 0,
    timestamp:   parseFloat(r.timestamp)    || 0,
    heart_rate:  parseFloat(r.heart_rate)   || 0,
    gsr:         parseFloat(r.gsr ?? r.gsr_pct) || 0,
    temperature: parseFloat(r.temperature)  || null,
    humidity:    parseFloat(r.humidity)     || null,
    hrv:         parseFloat(r.hrv)          || 0,
    ibi_ms:      parseFloat(r.ibi_ms)       || 0,
    received_at: r.received_at || '',
  }));

  // 2. Filter: drop HR=0 and HR>200 (spurious peaks)
  rows = rows.filter(r => r.heart_rate >= 40 && r.heart_rate <= 200);

  // 3. Filter: GSR must be > 0.5 (sensor dropout rows)
  rows = rows.filter(r => r.gsr > 0.5);

  // 4. Sort by timestamp, remove exact-timestamp duplicates
  rows.sort((a, b) => a.timestamp - b.timestamp);
  const seen = new Set();
  rows = rows.filter(r => {
    if (seen.has(r.timestamp)) return false;
    seen.add(r.timestamp);
    return true;
  });

  if (rows.length === 0) return { rows: [], summary: null };

  // ── Arrays for vectorised feature computation ─────────────────
  const HR  = rows.map(r => r.heart_rate);
  const GSR = rows.map(r => r.gsr);
  const TEMP = rows.map(r => r.temperature);
  const HUM  = rows.map(r => r.humidity);
  const HRV  = rows.map(r => r.hrv === 0 ? null : r.hrv);
  const tsMin = rows[0].timestamp;
  const tsMax = rows[rows.length - 1].timestamp;

  const W = inferWindowSize(rows, 30);

  const hrMean   = rollingMean(HR, W);
  const hrStd    = rollingStd(HR, W);
  const hrDelta  = diff(HR);
  const hrMax    = rollingMax(HR, W);

  const gsrMean  = rollingMean(GSR, W);
  const gsrStd   = rollingStd(GSR, W);
  const gsrDelta = diff(GSR);
  const gsrSpike = gsrDelta.map(d => Math.abs(d) > 5.0 ? 1 : 0); // 5% threshold for 0-100% range
  const gsrPeakCount = rollingSum(gsrSpike, W);

  // HRV with median-fill for zeros
  const hrvValid = HRV.filter(v => v !== null);
  const hrvMedian = hrvValid.length
    ? [...hrvValid].sort((a, b) => a - b)[Math.floor(hrvValid.length / 2)]
    : 40;
  const HRV_FILLED = HRV.map(v => v ?? hrvMedian);
  const hrvMean  = rollingMean(HRV_FILLED, W);
  const hrvRaw   = HRV_FILLED;
  const hrDiffArr = diff(HRV_FILLED);
  const hrvDrop  = hrDiffArr.map(d => d < 0 ? Math.abs(d) : 0);

  const tempDelta = diff(TEMP.map(v => v ?? 27.5));
  const humDelta  = diff(HUM.map(v => v ?? 50));

  // Heat index (simplified Steadman)
  const heatIndex = rows.map((r, i) => {
    const T = r.temperature ?? 27.5;
    const H = r.humidity ?? 50;
    return T + 0.33 * (H / 100 * 6.105 * Math.exp(17.27 * T / (T + 237.3))) - 4.0;
  });

  const gsrHrProduct = rows.map((r, i) => (GSR[i] * HR[i]) / 100.0);
  const hrvTempRatio = rows.map((r, i) => HRV_FILLED[i] / ((r.temperature ?? 27.5) + 1.0));
  const sessionProgress = rows.map(r =>
    (r.timestamp - tsMin) / (tsMax - tsMin + 1)
  );

  // ── Pseudo-label stress index ─────────────────────────────────
  const stressScores = rows.map((r, i) => {
    const hrNorm  = normalize(r.heart_rate, 40, 200);
    // GSR for your sensor is percentage, map 0-100 to 0-1
    const gsrNorm = normalize(r.gsr, 0, 100);
    const hrvInv  = 1 - normalize(HRV_FILLED[i], 5, 200);
    return clamp((0.35 * hrNorm + 0.45 * gsrNorm + 0.20 * hrvInv) * 100, 0, 100);
  });

  const labelFn = s => {
    if (s <= 35) return 'CALM';
    if (s <= 65) return 'MODERATE';
    if (s <= 85) return 'STRESSED';
    return 'CRITICAL';
  };

  // ── Assemble enriched rows ────────────────────────────────────
  const enriched = rows.map((r, i) => ({
    ...r,
    hrv_filled:       +HRV_FILLED[i].toFixed(2),
    hr_mean_30s:      hrMean[i] !== null   ? +hrMean[i].toFixed(2)   : null,
    hr_std_30s:       +hrStd[i].toFixed(2),
    hr_delta:         +hrDelta[i].toFixed(2),
    hr_max_30s:       hrMax[i],
    gsr_mean_30s:     gsrMean[i] !== null  ? +gsrMean[i].toFixed(3)  : null,
    gsr_std_30s:      +gsrStd[i].toFixed(3),
    gsr_delta:        +gsrDelta[i].toFixed(3),
    gsr_peak_count:   gsrPeakCount[i],
    hrv_mean_30s:     hrvMean[i] !== null  ? +hrvMean[i].toFixed(2)  : null,
    hrv_drop:         +hrvDrop[i].toFixed(2),
    heat_index:       +heatIndex[i].toFixed(2),
    temp_delta:       +tempDelta[i].toFixed(2),
    humidity_delta:   +humDelta[i].toFixed(2),
    gsr_hr_product:   +gsrHrProduct[i].toFixed(3),
    hrv_temp_ratio:   +hrvTempRatio[i].toFixed(3),
    session_progress: +sessionProgress[i].toFixed(4),
    stress_index:     +stressScores[i].toFixed(1),
    label:            labelFn(stressScores[i]),
  }));

  // ── Session summary (averages) ────────────────────────────────
  const summary = {
    student_id:        rows[0]?.id ? 'S01' : 'S01',
    total_rows:        enriched.length,
    duration_s:        Math.round((tsMax - tsMin) / 1000),
    avg_hr:            +(avg(HR)).toFixed(1),
    avg_gsr:           +(avg(GSR)).toFixed(3),
    avg_temp:          +(avg(TEMP)).toFixed(1),
    avg_humidity:      +(avg(HUM)).toFixed(1),
    avg_hrv:           +(avg(HRV_FILLED)).toFixed(1),
    avg_stress:        +(avg(stressScores)).toFixed(1),
    peak_hr:           Math.max(...HR),
    min_hr:            Math.min(...HR),
    peak_gsr:          +(Math.max(...GSR)).toFixed(3),
    avg_heat_index:    +(avg(heatIndex)).toFixed(2),
    avg_gsr_hr_product:+(avg(gsrHrProduct)).toFixed(3),
    label_counts: {
      CALM:     enriched.filter(r => r.label === 'CALM').length,
      MODERATE: enriched.filter(r => r.label === 'MODERATE').length,
      STRESSED: enriched.filter(r => r.label === 'STRESSED').length,
      CRITICAL: enriched.filter(r => r.label === 'CRITICAL').length,
    },
    dominant_label: (['CALM','MODERATE','STRESSED','CRITICAL'].reduce(
      (best, lbl) =>
        enriched.filter(r => r.label === lbl).length >
        enriched.filter(r => r.label === best).length ? lbl : best,
      'CALM'
    )),
  };

  return { rows: enriched, summary };
}

// ── GET /api/csv-session ──────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      return res.status(404).json({ error: 'readings.csv not found' });
    }
    const text = fs.readFileSync(CSV_PATH, 'utf8');
    const rawRows = parseCsv(text);
    const result = processSession(rawRows);
    res.json(result);
  } catch (err) {
    console.error('csv-session error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
