const express = require('express');
const router = express.Router();

// Mock Python FastAPI URL (to be replaced with actual ML container IP in .env later)
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * POST /api/ml/predict/live
 * Proxies a single real-time sensor reading to the ML instance.
 * Returns a fast fallback if the ML server is unreachable.
 */
router.post('/predict/live', async (req, res) => {
  try {
    // In actual implementation, we would perform:
    // const response = await fetch(`${ML_API_URL}/predict/live`, { ... })
    // const mlData = await response.json()
    // return res.json(mlData)

    // For now, return a scaffolding fallback demonstrating the contract
    res.json({
      fallback: true,
      stress_label: 'WAITING',
      stress_index: null,
      confidence: 0,
      message: 'ML backend not yet deployed. Track A/B pending.'
    });

  } catch (err) {
    res.status(503).json({ fallback: true, error: 'ML service offline' });
  }
});

/**
 * POST /api/ml/predict/csv
 * Proxies a batch CSV file buffer for processing.
 */
router.post('/predict/csv', async (req, res) => {
  try {
    // Scaffolding representation. 
    res.json({
      fallback: true,
      summary: 'Data accepted. Awaiting model deployment.',
      rows_processed: 0
    });
  } catch (err) {
    res.status(503).json({ fallback: true, error: 'ML service offline' });
  }
});

module.exports = router;
