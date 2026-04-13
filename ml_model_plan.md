# BioPulse ML Model Integration Plan

Date: 2026-04-13

## 1) Goal

Add a production-safe ML layer to BioPulse that can:

1. train from CSV/session data,
2. serve live and batch predictions,
3. integrate into the existing Node backend and React mobile app,
4. gracefully fall back to the current formula-based stress index when ML is unavailable.

This plan is designed for the current project state (existing WebSocket stream, SQLite backend, and React UI with live/mock modes).

## 2) Current Baseline (Already Present)

- Backend already receives and stores telemetry in SQLite.
- WebSocket feed already broadcasts normalized live readings.
- Mobile app already supports:
	- live and mock data source switching,
	- connection status handling,
	- live dashboard and history views.
- Formula-based stress calculation already exists and should remain the fallback path.

## 3) Target ML Scope

### In Scope (v1)

- Supervised 4-class classification:
	- 0: CALM
	- 1: MODERATE
	- 2: STRESSED
	- 3: CRITICAL
- FastAPI inference service with:
	- POST /predict/live
	- POST /predict/csv
	- GET /health
- Backend proxy routes:
	- POST /api/ml/predict/live
	- POST /api/ml/predict/csv
- LiveMonitor UI enhancements:
	- show ML output and confidence,
	- keep formula score visible for transparency,
	- fallback silently if ML is down.

### Out of Scope (v1)

- Full auto-retraining pipeline (CI scheduler).
- Multi-model online A/B testing.
- Cloud deployment.

## 4) Recommended Delivery Strategy

Use a 2-track approach so integration is stable early:

- Track A (ship first):
	- RandomForest or GradientBoosting with engineered features.
	- Fast to train, easy to debug, robust on small datasets.
- Track B (upgrade):
	- CNN-LSTM sequence model using sliding windows.
	- Better temporal learning once dataset volume is sufficient.

Deploy Track A first, keep Track B as planned upgrade behind a feature flag.

## 5) Data Contract and Schema Updates

### 5.1 Telemetry fields required for ML

Required fields per reading:

- timestamp
- heart_rate
- spo2
- gsr
- hrv
- temperature
- humidity
- label (for offline training datasets)

Note: the current live DB schema does not include temperature/humidity columns. Add them before ML rollout.

### 5.2 SQLite migration (backend)

Add new columns to readings table:

- temperature REAL
- humidity REAL
- ml_stress_label TEXT
- ml_confidence REAL
- ml_stress_index REAL

Optional:

- ml_model_version TEXT
- ml_latency_ms REAL

### 5.3 Payload normalization

Update backend payload normalizer to accept both styles:

- heartRate and heart_rate
- temperature and temp
- humidity and hum

## 6) Project Structure to Add

Create under project root:

- ml/
	- data/
		- raw/
		- processed/
		- combined_dataset.csv
	- src/
		- preprocess.py
		- train.py
		- evaluate.py
		- predict.py
		- api.py
	- models/
		- stress_model.pkl
		- metadata.json
	- requirements.txt
	- README_ML.md

If deep model is enabled later, add:

- src/train_deep.py
- models/best_cnn_lstm.pt

## 7) Phased Execution Plan

## Phase 0 - Environment Setup

Tasks:

- Create Python 3.10+ virtual environment in ml/.
- Install dependencies from requirements.txt.
- Add .env support in backend for ML_API_URL.

Deliverable:

- ML environment starts and GET /health returns OK.

## Phase 1 - Data Collection and Labeling Bootstrap

Tasks:

- Export existing session history into training CSV format.
- Create initial pseudo-labels using current formula-based stress logic.
- Maintain label map 0-3 consistently across backend, ML, and UI.

Deliverable:

- First combined_dataset.csv with documented label balance.

## Phase 2 - Preprocessing and Feature Engineering

Tasks:

- Implement cleaning rules (range filtering, missing value handling, de-dup by timestamp).
- Add smoothing/filtering (rolling means, low-pass where needed).
- Add engineered features including interaction terms and session progression.

Deliverable:

- Reproducible preprocess.py that converts raw CSV to training-ready features.

## Phase 3 - Baseline Model Training (Track A)

Tasks:

- Train RandomForest pipeline with scaler and class balancing.
- Cross-validate using StratifiedKFold.
- Save model artifact and metadata (feature list, label map, metrics, train date).

Deliverable:

- models/stress_model.pkl and evaluation report.

## Phase 4 - Inference API

Tasks:

- Implement FastAPI endpoints:
	- POST /predict/live
	- POST /predict/csv
	- GET /health
- Include strict request validation and friendly error payloads.
- Return standard response fields:
	- stress_label
	- stress_index (0-100)
	- confidence
	- probabilities
	- environmental_flag

Deliverable:

- Local ML service serving deterministic predictions.

## Phase 5 - Backend Integration

Tasks:

- Add ML proxy routes in backend server.
- On successful ML prediction, store ml_* columns in readings.
- Add timeout and fallback logic:
	- if ML request fails or times out, return fallback=true,
	- do not block live telemetry flow.

Deliverable:

- Backend can enrich readings with ML output without breaking existing APIs.

## Phase 6 - Mobile App Integration

Tasks:

- Add hook: src/hooks/useMLPrediction.js.
- In Live Monitor:
	- call ML route periodically or on each reading with throttling,
	- show Formula and ML scores side-by-side,
	- show confidence and model availability badge.
- In History:
	- add CSV upload panel for batch inference,
	- overlay ML labels in detail view where available.

Deliverable:

- End-user can see ML-enhanced stress prediction in app with transparent fallback.

## Phase 7 - Validation and Rollout

Tasks:

- Compare formula vs ML outputs over real sessions.
- Track metrics:
	- weighted F1,
	- per-class precision/recall,
	- inference latency,
	- ML availability rate.
- Add feature flag in frontend setting:
	- ML mode ON/OFF.

Deliverable:

- Controlled rollout with measurable model quality and reliability.

## 8) Backend Integration Details (File-Level)

Primary file touch points:

- biopulse/backend/server.js
	- add DB migration logic for new columns,
	- add ML proxy routes,
	- update normalizeTelemetryPayload to include temp/humidity.

Optional helper files to add:

- biopulse/backend/routes/ml.js
	- keep ML routes isolated and easier to test.

## 9) Mobile Integration Details (File-Level)

Primary file touch points:

- biopulse/mobile-app/src/screens/LiveMonitor.jsx
	- display ML score, confidence, model state.
- biopulse/mobile-app/src/screens/History.jsx
	- add CSV upload and batch analysis entry point.
- biopulse/mobile-app/src/context/stressState.js and related context files
	- store optional mlResult and mlAvailable state.

New files to add:

- biopulse/mobile-app/src/hooks/useMLPrediction.js
- biopulse/mobile-app/src/components/MLBadge.jsx
- biopulse/mobile-app/src/components/ConfidenceBar.jsx
- biopulse/mobile-app/src/components/CSVUploadPanel.jsx

## 10) API Contracts

### 10.1 POST /api/ml/predict/live (backend proxy)

Request body should include:

- raw reading (heart_rate, spo2, gsr, hrv, temperature, humidity)
- rolling stats needed by model (or backend-calculated)
- session_progress

Response:

- stress_label
- stress_index
- confidence
- probabilities
- environmental_flag
- fallback (boolean)

### 10.2 POST /api/ml/predict/csv (backend proxy)

Request:

- multipart CSV file or csv_content text
- optional student_id

Response:

- session summary
- per-reading predictions
- dominant state and spike count

## 11) Reliability Rules

- Never block core telemetry path if ML is down.
- Timeout ML calls (for example 800ms to 1500ms).
- Use formula-based stress index as immediate fallback.
- Log ML failures with reason and count.
- Expose backend health including ML dependency status.

## 12) Acceptance Criteria

Functional:

- Live predictions visible in app when ML service is healthy.
- App stays fully usable when ML service is offline.
- CSV batch analysis returns summary and per-row labels.

Quality:

- Weighted F1 >= 0.80 on held-out set for v1 baseline.
- P95 live inference round-trip <= 500ms on local network.
- No crash/regression in current live monitor workflow.

Data:

- At least 5 to 10 sessions per class target over time.
- Class imbalance tracked and reported in metadata.

## 13) Suggested Milestone Timeline

- M1 (Day 1-2): Phase 0-1 completed.
- M2 (Day 3-4): Phase 2-3 completed with baseline model artifact.
- M3 (Day 5): Phase 4 API online and tested.
- M4 (Day 6-7): Phase 5-6 integrated into backend and app.
- M5 (Day 8): Phase 7 validation, tuning, and go/no-go decision.

## 14) Upgrade Path (After v1)

- Add CNN-LSTM sequence model as optional model_type=deep.
- Keep RandomForest as safety baseline and ensemble option.
- Add periodic retraining from newly collected labeled sessions.
- Move model registry metadata into versioned model manifests.

---

This plan keeps your current architecture intact, adds ML safely, and ensures you can ship a first working version quickly before moving to deeper models.
