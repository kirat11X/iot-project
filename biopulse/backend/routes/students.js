const express = require('express');
const router = express.Router();

// Extrapolate distinct student IDs historically cached by the system
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  try {
    const students = db.prepare('SELECT DISTINCT student_id FROM readings WHERE student_id IS NOT NULL').all();
    res.json(students.map(r => r.student_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
