const express = require('express');
const router = express.Router();

// GET all sessions
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const sessions = db.prepare(`
      SELECT
        sessions.id,
        sessions.student_id,
        sessions.started_at,
        sessions.ended_at,
        COUNT(readings.id) AS readingCount,
        CASE
          WHEN COUNT(readings.id) = 0 THEN NULL
          ELSE ROUND(AVG(readings.stress_index), 1)
        END AS avgStress,
        MAX(readings.stress_index) AS peakStress,
        (
          SELECT readings_peak.timestamp
          FROM readings AS readings_peak
          WHERE readings_peak.session_id = sessions.id
          ORDER BY readings_peak.stress_index DESC, readings_peak.timestamp DESC
          LIMIT 1
        ) AS peakTimestamp
      FROM sessions
      LEFT JOIN readings ON readings.session_id = sessions.id
      GROUP BY sessions.id
      ORDER BY sessions.started_at DESC
    `).all();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET specific session logic with populated readings array
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session record not found.' });
    
    session.readings = db.prepare('SELECT * FROM readings WHERE session_id = ? ORDER BY timestamp ASC').all(req.params.id);
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST to instate a generic classroom recording session
router.post('/start', (req, res) => {
  const db = req.app.locals.db;
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Constraint Violated: student_id missing' });

  try {
    const info = db.prepare('INSERT INTO sessions (student_id, started_at) VALUES (?, ?)').run(student_id, Date.now());
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST append end_time when session terminates
router.post('/end/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(Date.now(), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', (req, res) => {
  const db = req.app.locals.db;

  try {
    const clearAllSessions = db.transaction(() => {
      const clearedReadings = db.prepare('DELETE FROM readings').run().changes;
      const clearedSessions = db.prepare('DELETE FROM sessions').run().changes;
      return { clearedSessions, clearedReadings };
    });

    res.json(clearAllSessions());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
