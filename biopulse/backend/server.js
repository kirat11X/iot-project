const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
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
    ml_stress_label TEXT,
    ml_confidence REAL,
    ml_stress_index REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

const app = express();
app.use(cors());
app.use(express.json());

// Expose DB to routes via app.locals
app.locals.db = db;

// Import REST Routes
const sessionsRouter = require('./routes/sessions');
const studentsRouter = require('./routes/students');
const mlRouter = require('./routes/ml');

app.use('/api/sessions', sessionsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/ml', mlRouter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/live' });

function normalizeTelemetryPayload(payload) {
  return {
    sessionId: payload.session_id ?? payload.sessionId ?? null,
    studentId: payload.student_id ?? payload.studentId ?? 'UNKNOWN',
    timestamp: payload.timestamp ?? Date.now(),
    heartRate: payload.heartRate ?? payload.heart_rate,
    spo2: payload.spo2,
    gsr: payload.gsr,
    hrv: payload.hrv,
    temperature: payload.temperature ?? payload.temp ?? null,
    humidity: payload.humidity ?? payload.hum ?? null,
    stressIndex: payload.stressIndex ?? payload.stress_index ?? null,
    ledState: payload.led_state ?? payload.ledState ?? '',
    mlStressLabel: payload.mlStressLabel ?? payload.ml_stress_label ?? null,
    mlConfidence: payload.mlConfidence ?? payload.ml_confidence ?? null,
    mlStressIndex: payload.mlStressIndex ?? payload.ml_stress_index ?? null,
  };
}

// WebSocket Broadcasting
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = normalizeTelemetryPayload(JSON.parse(message));

      // Verification that this is a valid reading broadcast
      if (data.heartRate !== undefined) {
        // Log telemetry conditionally if linked to an active session_id
        if (data.sessionId) {
          const stmt = db.prepare(`
            INSERT INTO readings (
              session_id, student_id, timestamp, heart_rate, spo2, gsr, hrv, stress_index, led_state,
              temperature, humidity, ml_stress_label, ml_confidence, ml_stress_index
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            data.sessionId,
            data.studentId,
            data.timestamp,
            data.heartRate,
            data.spo2,
            data.gsr,
            data.hrv,
            data.stressIndex ?? 0,
            data.ledState,
            data.temperature,
            data.humidity,
            data.mlStressLabel,
            data.mlConfidence,
            data.mlStressIndex
          );
        }

        // Broadcast to all active BioPulse Mobile App clients
        wss.clients.forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
    } catch (e) {
      console.error('WebSocket Payload Error:', e);
    }
  });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`BioPulse Engine Booted: http://0.0.0.0:${PORT}`);
  console.log(`Biometric WebSocket active: ws://0.0.0.0:${PORT}/live`);
});
