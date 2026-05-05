const express = require('express');
const router = express.Router();

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * GET /api/ml/health
 * Quick check on whether the Python ML server is reachable.
 */
router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${ML_API_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json();
    res.json({ online: true, ...data });
  } catch (err) {
    res.json({ online: false, error: err.message });
  }
});

/**
 * POST /api/ml/predict/live
 * Proxies a live window of readings ({ readings: [...] }) to the ML predict/live endpoint.
 * Falls back gracefully if the ML server is offline or not ready.
 */
router.post('/predict/live', async (req, res) => {
  try {
    const body = req.body;
    const response = await fetch(`${ML_API_URL}/predict/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`ML API responded with ${response.status}`);
    }
    const mlData = await response.json();
    return res.json(mlData);
  } catch (err) {
    console.warn('ML Service error:', err.message);
    res.status(503).json({ fallback: true, error: 'ML service offline', stress_label: 'WAITING' });
  }
});

/**
 * GET /api/ml/predict/latest
 * Runs inference on the full latest CSV — useful for history screens.
 */
router.get('/predict/latest', async (req, res) => {
  try {
    const response = await fetch(`${ML_API_URL}/predict/latest`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`ML API responded with ${response.status}`);
    }
    const mlData = await response.json();
    return res.json(mlData);
  } catch (err) {
    console.warn('ML Service error:', err.message);
    res.status(503).json({ fallback: true, error: 'ML service offline', stress_label: 'WAITING' });
  }
});

/**
 * POST /api/ml/predict/csv
 * Proxies a batch CSV file buffer for processing.
 */
router.post('/predict/csv', async (req, res) => {
  try {
    res.json({
      fallback: true,
      summary: 'Data accepted. Awaiting model deployment.',
      rows_processed: 0,
    });
  } catch (err) {
    res.status(503).json({ fallback: true, error: 'ML service offline' });
  }
});

module.exports = router;
