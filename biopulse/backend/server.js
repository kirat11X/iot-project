const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ── Live rolling window for ML inference ──────────────────────────────────────
const LIVE_WINDOW_SIZE = 30;
const liveWindow = [];     // { timestamp, heart_rate, hrv, gsr_pct, temperature, humidity, ibi_ms }
const ibiHistory = [];     // last 30 IBI values for RMSSD
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const csvFilePath = path.join(dbDir, 'readings.csv');
const CSV_COLUMNS = [
  'id',
  'session_id',
  'student_id',
  'timestamp',
  'heart_rate',
  'gsr',
  'hrv',
  'stress_index',
  'led_state',
  'temperature',
  'humidity',
  'ibi_ms',
  'ml_stress_label',
  'ml_confidence',
  'ml_stress_index',
  'received_at',
];
const csvHeader = CSV_COLUMNS.join(',');

if (!fs.existsSync(csvFilePath)) {
  fs.writeFileSync(csvFilePath, `${csvHeader}\n`, 'utf8');
}

const finalCsvFilePath = path.join(dbDir, 'reading_final.csv');
if (!fs.existsSync(finalCsvFilePath)) {
  fs.writeFileSync(finalCsvFilePath, `${csvHeader}\n`, 'utf8');
}

const db = new Database(path.join(dbDir, 'sessions.db'));

// Schema initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    student_id TEXT,
    timestamp INTEGER,
    heart_rate REAL,
    spo2 REAL,
    gsr REAL,
    hrv REAL,
    stress_index REAL,
    led_state TEXT,
    temperature REAL,
    humidity REAL,
    ibi_ms REAL,
    ml_stress_label TEXT,
    ml_confidence REAL,
    ml_stress_index REAL,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn('readings', 'temperature', 'REAL');
ensureColumn('readings', 'humidity', 'REAL');
ensureColumn('readings', 'ibi_ms', 'REAL');
ensureColumn('readings', 'ml_stress_label', 'TEXT');
ensureColumn('readings', 'ml_confidence', 'REAL');
ensureColumn('readings', 'ml_stress_index', 'REAL');
ensureColumn('readings', 'received_at', 'TEXT');

const app = express();
app.use(cors());
app.use(express.json());

// Expose DB to routes via app.locals
app.locals.db = db;

// Import REST Routes
const sessionsRouter = require('./routes/sessions');
const studentsRouter = require('./routes/students');
const mlRouter = require('./routes/ml');
const csvSessionRouter = require('./routes/csvSession');

app.use('/api/sessions', sessionsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/ml', mlRouter);
app.use('/api/csv-session', csvSessionRouter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const insertReading = db.prepare(`
  INSERT INTO readings (
    session_id, student_id, timestamp, heart_rate, spo2, gsr, hrv, stress_index, led_state,
    temperature, humidity, ibi_ms, ml_stress_label, ml_confidence, ml_stress_index, received_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateReadingPrediction = db.prepare(`
  UPDATE readings
  SET stress_index = ?, ml_stress_label = ?, ml_confidence = ?, ml_stress_index = ?
  WHERE id = ?
`);

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return null;
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeMetric(value, { min = null, max = null, allowZero = false } = {}) {
  const numeric = toNumberOrNull(value);
  if (numeric === null) {
    return null;
  }
  if (!allowZero && numeric === 0) {
    return null;
  }
  if (min !== null && numeric < min) {
    return null;
  }
  if (max !== null && numeric > max) {
    return null;
  }

  return numeric;
}

function isValidCoreReading(data) {
  return Number.isFinite(data.heartRate)
    && data.heartRate >= 40
    && data.heartRate <= 200
    && Number.isFinite(data.gsr)
    && data.gsr > 0.5;
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsvText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/);
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = splitCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      return row;
    });
}

function normalizeTelemetryPayload(payload) {
  const timestamp = toNumberOrNull(firstPresent(payload.timestamp)) ?? Date.now();

  return {
    sessionId: firstDefined(payload.session_id, payload.sessionId),
    studentId: firstPresent(payload.student_id, payload.studentId) || 'S01',
    timestamp,
    heartRate: sanitizeMetric(firstDefined(payload.heartRate, payload.heart_rate), { min: 1, max: 240 }),
    spo2: null,
    gsr: sanitizeMetric(firstDefined(payload.gsr_pct, payload.gsrPercentage, payload.gsr_percentage, payload.gsr), { min: 0.1, max: 100 }),
    hrv: sanitizeMetric(firstDefined(payload.hrv), { min: 1, max: 250 }),
    temperature: sanitizeMetric(firstDefined(payload.temperature, payload.temp), { min: 1, max: 80 }),
    humidity: sanitizeMetric(firstDefined(payload.humidity, payload.hum), { min: 1, max: 100 }),
    ibi_ms: sanitizeMetric(firstDefined(payload.ibi_ms), { min: 200, max: 2000 }),
    stressIndex: sanitizeMetric(firstDefined(payload.stressIndex, payload.stress_index), { min: 0, max: 100 }),
    sensorMode: firstPresent(payload.sensor_mode, payload.sensorMode),
    rawHeartRate: toNumberOrNull(firstDefined(payload.raw_hr, payload.rawHeartRate)),
    voltageHeartRate: toNumberOrNull(firstDefined(payload.voltage_hr, payload.voltageHeartRate)),
    rawGsr: toNumberOrNull(firstDefined(payload.raw_gsr, payload.rawGsr)),
    gsrPercentage: sanitizeMetric(firstDefined(payload.gsr_pct, payload.gsrPercentage, payload.gsr_percentage), { min: 0.1, max: 100 }),
    ledState: firstPresent(payload.led_state, payload.ledState) || '',
    mlStressLabel: firstDefined(payload.mlStressLabel, payload.ml_stress_label),
    mlConfidence: sanitizeMetric(firstDefined(payload.mlConfidence, payload.ml_confidence), { min: 0, max: 1, allowZero: true }),
    mlStressIndex: sanitizeMetric(firstDefined(payload.mlStressIndex, payload.ml_stress_index), { min: 0, max: 100 }),
    receivedAt: new Date().toISOString(),
  };
}

function hasTelemetry(data) {
  return [
    data.heartRate,
    data.gsr,
    data.hrv,
    data.temperature,
    data.humidity,
    data.stressIndex,
  ].some((value) => value !== undefined && value !== null);
}

function toClientPayload(data) {
  return {
    sessionId: data.sessionId,
    session_id: data.sessionId,
    studentId: data.studentId,
    student_id: data.studentId,
    timestamp: data.timestamp,
    heartRate: data.heartRate,
    heart_rate: data.heartRate,
    gsr: data.gsr,
    hrv: data.hrv,
    ibi_ms: data.ibi_ms,
    temperature: data.temperature,
    humidity: data.humidity,
    stressIndex: data.stressIndex ?? null,
    stress_index: data.stressIndex ?? null,
    ledState: data.ledState,
    led_state: data.ledState,
    mlStressLabel: data.mlStressLabel,
    ml_stress_label: data.mlStressLabel,
    mlConfidence: data.mlConfidence,
    ml_confidence: data.mlConfidence,
    mlStressIndex: data.mlStressIndex,
    ml_stress_index: data.mlStressIndex,
    sensorMode: data.sensorMode,
    sensor_mode: data.sensorMode,
    rawHeartRate: data.rawHeartRate,
    raw_hr: data.rawHeartRate,
    voltageHeartRate: data.voltageHeartRate,
    voltage_hr: data.voltageHeartRate,
    rawGsr: data.rawGsr,
    raw_gsr: data.rawGsr,
    gsrPercentage: data.gsrPercentage,
    gsr_percentage: data.gsrPercentage,
  };
}

function toCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function normalizeCsvRow(row) {
  const stressIndex = sanitizeMetric(row.ml_stress_index ?? row.stress_index, { min: 0, max: 100 });

  return {
    id: toNumberOrNull(row.id),
    session_id: firstPresent(row.session_id),
    student_id: firstPresent(row.student_id) || 'S01',
    timestamp: toNumberOrNull(row.timestamp),
    heart_rate: sanitizeMetric(row.heart_rate, { min: 40, max: 200 }),
    gsr: sanitizeMetric(row.gsr ?? row.gsr_pct, { min: 0.5, max: 100 }),
    hrv: sanitizeMetric(row.hrv, { min: 1, max: 250 }),
    stress_index: stressIndex,
    led_state: firstPresent(row.led_state) || '',
    temperature: sanitizeMetric(row.temperature, { min: 10, max: 60 }),
    humidity: sanitizeMetric(row.humidity, { min: 1, max: 100 }),
    ibi_ms: sanitizeMetric(row.ibi_ms, { min: 200, max: 2000 }),
    ml_stress_label: firstPresent(row.ml_stress_label),
    ml_confidence: sanitizeMetric(row.ml_confidence, { min: 0, max: 1, allowZero: true }),
    ml_stress_index: sanitizeMetric(row.ml_stress_index, { min: 0, max: 100 }),
    received_at: firstPresent(row.received_at) || '',
  };
}

function isValidCsvRow(row) {
  return Number.isFinite(row.timestamp)
    && Number.isFinite(row.heart_rate)
    && Number.isFinite(row.gsr);
}

function serializeCsvRows(rows) {
  const body = rows.map((row) => (
    CSV_COLUMNS.map((column) => toCsvValue(row[column])).join(',')
  )).join('\n');

  return body ? `${csvHeader}\n${body}\n` : `${csvHeader}\n`;
}

function rewriteCsvRows(rows) {
  fs.writeFileSync(csvFilePath, serializeCsvRows(rows), 'utf8');
}

function sanitizeReadingsCsv() {
  if (!fs.existsSync(csvFilePath)) {
    rewriteCsvRows([]);
    return;
  }

  const text = fs.readFileSync(csvFilePath, 'utf8');
  const cleanedRows = parseCsvText(text)
    .map(normalizeCsvRow)
    .filter(isValidCsvRow);

  rewriteCsvRows(cleanedRows);
}

function patchCsvReading(readingId, patch) {
  if (!fs.existsSync(csvFilePath)) {
    return;
  }

  const rows = parseCsvText(fs.readFileSync(csvFilePath, 'utf8'));
  let changed = false;

  const updatedRows = rows.map((row) => {
    if (Number(row.id) !== readingId) {
      return row;
    }

    changed = true;
    return {
      ...row,
      ...patch,
    };
  });

  if (!changed) {
    return;
  }

  rewriteCsvRows(
    updatedRows
      .map(normalizeCsvRow)
      .filter(isValidCsvRow)
  );
}

function appendReadingToCsv(readingId, data) {
  const row = [
    readingId,
    data.sessionId,
    data.studentId,
    data.timestamp,
    data.heartRate,
    data.gsr,
    data.hrv,
    data.stressIndex ?? null,
    data.ledState,
    data.temperature,
    data.humidity,
    data.ibi_ms,
    data.mlStressLabel,
    data.mlConfidence,
    data.mlStressIndex,
    data.receivedAt,
  ].map(toCsvValue).join(',');

  fs.appendFileSync(csvFilePath, `${row}\n`, 'utf8');
}

function appendToFinalCsv(data) {
  const row = [
    '', // No ID
    data.sessionId,
    data.studentId,
    data.timestamp,
    data.heartRate !== null ? data.heartRate : 0, // Ensure 0 is shown
    data.gsr !== null ? data.gsr : 0.0,
    data.hrv !== null ? data.hrv : 0,
    data.stressIndex ?? null,
    data.ledState,
    data.temperature !== null ? data.temperature : 0.0,
    data.humidity !== null ? data.humidity : 0.0,
    data.ibi_ms !== null ? data.ibi_ms : 0,
    data.mlStressLabel,
    data.mlConfidence,
    data.mlStressIndex,
    data.receivedAt,
  ].map(toCsvValue).join(',');

  fs.appendFileSync(finalCsvFilePath, `${row}\n`, 'utf8');
}

sanitizeReadingsCsv();

function saveReading(data) {
  return insertReading.run(
    data.sessionId,
    data.studentId,
    data.timestamp,
    data.heartRate,
    data.spo2,
    data.gsr,
    data.hrv,
    data.stressIndex ?? null,
    data.ledState,
    data.temperature,
    data.humidity,
    data.ibi_ms,
    data.mlStressLabel,
    data.mlConfidence,
    data.mlStressIndex,
    data.receivedAt
  );
}

function savePrediction(readingId, prediction) {
  updateReadingPrediction.run(
    prediction.stress_index,
    prediction.stress_label,
    prediction.confidence,
    prediction.stress_index,
    readingId
  );

  patchCsvReading(readingId, {
    stress_index: prediction.stress_index,
    ml_stress_label: prediction.stress_label,
    ml_confidence: prediction.confidence,
    ml_stress_index: prediction.stress_index,
  });
}

function broadcastToAll(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcastReading(data, sender = null) {
  const payload = JSON.stringify(toClientPayload(data));
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ── Compute RMSSD HRV from last N IBI values ────────────────────────────────
function computeRMSSD(ibis) {
  if (!ibis || ibis.length < 2) return null;
  let sumSq = 0;
  let count = 0;
  for (let i = 1; i < ibis.length; i++) {
    const diff = ibis[i] - ibis[i - 1];
    sumSq += diff * diff;
    count++;
  }
  return count > 0 ? Math.round(Math.sqrt(sumSq / count)) : null;
}

// ── Boot up: pre-fill liveWindow with last 30 valid DB readings ─────────────
try {
  const lastRows = db.prepare(`
    SELECT timestamp, heart_rate, hrv, gsr, temperature, humidity, ibi_ms 
    FROM readings 
    WHERE heart_rate >= 40 AND gsr >= 0.5 
    ORDER BY timestamp DESC LIMIT 30
  `).all().reverse();

  lastRows.forEach(row => {
    if (row.ibi_ms) {
      ibiHistory.push(row.ibi_ms);
      if (ibiHistory.length > 60) ibiHistory.shift();
    }
    liveWindow.push({
      timestamp: row.timestamp,
      heart_rate: row.heart_rate,
      hrv: row.hrv || 40,
      gsr_pct: row.gsr,
      temperature: row.temperature,
      humidity: row.humidity,
      ibi_ms: row.ibi_ms || Math.round(60000 / row.heart_rate)
    });
  });
  console.log(`Preloaded ${liveWindow.length} rows for ML inference window.`);
} catch (e) {
  console.log('Could not preload live window from DB:', e.message);
}

// ── Push reading into rolling live window and run ML asynchronously ──────────
async function updateLiveWindowAndInfer(readingId, data) {
  const hr = data.heartRate;
  const gsr = data.gsr;
  const temp = data.temperature;
  const hum = data.humidity;
  const hrv = data.hrv;

  // Only run ML if core signals make sense
  if (!isValidCoreReading(data)) return;

  const row = {
    timestamp: data.timestamp,
    heart_rate: hr,
    hrv: hrv,
    gsr_pct: gsr,
    temperature: temp || 25,
    humidity: hum || 50,
    ibi_ms: data.ibi_ms ?? Math.round(60000 / hr),
  };

  liveWindow.push(row);
  if (liveWindow.length > LIVE_WINDOW_SIZE) liveWindow.shift();

  if (liveWindow.length < LIVE_WINDOW_SIZE) {
    // Tell frontend we are buffering for ML
    broadcastToAll({
      type: 'ML_RESULT',
      stress_index: null,
      stress_label: 'BUFFERING',
      model_mode: 'buffering',
      hrv: hrv
    });
    return;
  }

  try {
    const mlRes = await fetch(`${ML_API_URL}/predict/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings: liveWindow }),
      signal: AbortSignal.timeout(3000),
    });
    if (!mlRes.ok) return;
    const mlData = await mlRes.json();
    if (mlData.fallback || mlData.error) return;

    savePrediction(readingId, mlData);

    broadcastToAll({
      type: 'ML_RESULT',
      reading_id: readingId,
      stress_index: mlData.stress_index,
      stress_label: mlData.stress_label,
      confidence: mlData.confidence,
      probabilities: mlData.probabilities,
      model_mode: mlData.model_mode,
      hrv: hrv, // include attached HRV
    });
  } catch (err) {
    // Ignore offline errors
  }
}

function handleIncomingReading(rawPayload, sender = null) {
  const data = normalizeTelemetryPayload(rawPayload);
  if (!hasTelemetry(data)) {
    throw new Error('No telemetry fields found in payload.');
  }

  // 1. Compute missing IBI & HRV before saving/broadcasting
  if (data.heartRate && data.heartRate > 0) {
    if (data.ibi_ms && data.ibi_ms > 200 && data.ibi_ms < 2000) {
      ibiHistory.push(data.ibi_ms);
      if (ibiHistory.length > 60) ibiHistory.shift();
    } else {
      const estimatedIbi = Math.round(60000 / data.heartRate);
      ibiHistory.push(estimatedIbi);
      if (ibiHistory.length > 60) ibiHistory.shift();
      data.ibi_ms = estimatedIbi;
    }
  }
  
  if (!data.hrv || data.hrv <= 0) {
    const computedHrv = computeRMSSD(ibiHistory);
    // If not enough IBI history yet, fallback to sensible 40ms, so it's not 0 or null
    data.hrv = computedHrv ?? 40; 
  }

  const shouldPersistReading = isValidCoreReading(data);

  // Always forward live telemetry to connected clients, even while BPM is still warming up.
  // Persistence + ML stay restricted to valid core readings so readings.csv remains clean.
  broadcastReading(data, sender);

  // Append everything (even 0s) to reading_final.csv per user request
  appendToFinalCsv(data);

  if (!shouldPersistReading) {
    return { data, ignored: true, result: null };
  }

  // 2. Save reading with full HRV/IBI 
  const result = saveReading(data);
  appendReadingToCsv(result.lastInsertRowid, data);
  console.log('Saved:', toClientPayload(data));

  // 3. Fire ML inferencer
  updateLiveWindowAndInfer(result.lastInsertRowid, data).catch(() => {});

  return { data, result, ignored: false };
}

app.post('/api/data', (req, res) => {
  try {
    const { data, result, ignored } = handleIncomingReading(req.body);
    res.json({
      status: 'ok',
      ignored,
      id: result?.lastInsertRowid ?? null,
      reading: toClientPayload(data),
    });
  } catch (err) {
    console.error('Error on /api/data:', err);
    res.status(400).json({ status: 'error', error: err.message });
  }
});

app.get('/api/readings', (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 100;

  try {
    const rows = db.prepare('SELECT * FROM readings ORDER BY id DESC LIMIT ?').all(limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

wss.on('connection', (ws, request) => {
  const source = request.headers['x-source'] || request.url || 'unknown';
  console.log(`New WS connection from: ${source}`);

  ws.on('message', (message) => {
    try {
      handleIncomingReading(JSON.parse(message), ws);
    } catch (e) {
      console.error('WebSocket Payload Error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (pathname !== '/' && pathname !== '/live') {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`BioPulse Engine Booted: http://0.0.0.0:${PORT}`);
  console.log(`Biometric WebSocket active: ws://0.0.0.0:${PORT}/live and ws://0.0.0.0:${PORT}/`);
  console.log(`REST telemetry intake active: http://0.0.0.0:${PORT}/api/data`);
});
