# BioPulse Upgrade and Future Roadmap

This document tracks what has already been completed in BioPulse, what is partially implemented, and what should be built next. It is aligned with the current project code, [readme.md](readme.md), and [report.md](report.md).

## Current Active System

The current working prototype uses the WiFi/WebSocket path:

```text
ESP32 sensor device -> WiFi/WebSocket -> Laptop Node.js backend -> SQLite/CSV/ML API
React/Capacitor dashboard -> WebSocket/REST -> Laptop Node.js backend
```

The planned BLE phone-gateway architecture is still a future upgrade. For now, the ESP32 sends readings directly to the laptop server.

## Current Hardware Path

| Component | Status | Notes |
|---|---|---|
| ESP32 firmware | Done | Firmware exists at `biopulse/firmware/src/main.cpp` |
| GSR sensor | Done | Analog input on GPIO 35 |
| Heart-rate input | Done | Analog pulse signal on GPIO 33 |
| DHT11 | Done | Temperature/humidity on GPIO 26 |
| WiFi transport | Done | ESP32 sends JSON to `ws://<laptop-ip>:3001/` |
| Physical LED actuator | Not done | Dashboard has LED-style indicators, but firmware does not yet drive a physical LED pin |
| BLE transport | Not done | Planned future replacement for direct WiFi device streaming |

## What Is Done

### Firmware

- ESP32 reads GSR, heart-rate analog signal, temperature, and humidity.
- Firmware prints CSV rows to Serial Monitor.
- Firmware sends JSON telemetry over WebSocket to the backend.
- Basic heart-rate peak detection estimates BPM and IBI.
- Simplified HRV is calculated from recent IBI values.
- WiFi reconnect behavior is handled through the WebSocket client reconnect interval.

### Backend

- Node.js backend runs on port `3001`.
- Express REST routes are available for readings, sessions, students, CSV sessions, and ML proxy calls.
- WebSocket endpoints are available at `/` and `/live`.
- Incoming telemetry is normalized across snake_case and camelCase fields.
- Sensor readings are sanitized with practical range checks.
- Valid readings are stored in SQLite.
- CSV export/log files are generated locally.
- Raw rows are kept separately from analysis-ready rows.
- Rolling live windows are prepared for ML inference.

### Mobile Dashboard

- React/Capacitor app is implemented.
- Live Monitor screen shows live readings, stress gauge, vitals, and connection status.
- History screen supports session/history review and export flow.
- Analysis screen has class/student style analytics components.
- Settings screen supports backend IP and configuration controls.
- Dashboard can read live data from the backend WebSocket.
- Mock and live modes exist for development/testing.

### ML Pipeline

- ML preprocessing code exists in `ml_model/src/preprocess.py`.
- Training pipeline exists in `ml_model/src/train_pipeline.py`.
- FastAPI inference service exists in `ml_model/src/api.py`.
- Track A model design uses CNN-LSTM.
- Track B model design uses Random Forest statistical features.
- The backend can proxy to the ML API and broadcast ML results when the service/artifacts are available.
- Model artifacts and training datasets are intentionally ignored by GitHub.

### Documentation and GitHub Readiness

- `report.md` has been created with the full technical report.
- `readme.md` has been updated to match the actual project.
- `.gitignore` has been expanded for local data, training datasets, model artifacts, build outputs, dependency folders, and virtual environments.
- Large/generated files have been removed from Git tracking while remaining on the local machine.

## Partially Done / Needs Finishing

| Area | Current state | What remains |
|---|---|---|
| Actuator | Dashboard LED indicators exist; `led_state` exists in backend schema | Add physical RGB LED pins and firmware control |
| Data collection | Local SQLite/CSV data exists, including calibration and valid rows | Collect cleaner labeled sessions with event markers |
| ML | Pipeline and API exist | Rebuild artifacts locally after ignored dataset/model cleanup and evaluate with real labels |
| Cloud | Laptop acts as private cloud/fog node | Deploy backend/API to secure cloud or keep laptop as documented local server |
| Security | Local prototype works on LAN | Add authentication, HTTPS/WSS, and access control |
| Mobile offline mode | UI/state exists, but no real persistent offline queue | Add phone-side session storage and sync retry |
| BLE plan | Roadmap exists | Implement firmware BLE peripheral and mobile BLE client |

## Immediate Next Upgrades

These are the most useful short-term upgrades before a final demo or GitHub submission.

### 1. Add Physical LED Actuator

Goal: satisfy the actuator requirement with visible hardware feedback.

Tasks:

- Wire RGB LED or three separate LEDs with resistors.
- Add LED GPIO constants in `biopulse/firmware/src/main.cpp`.
- Map stress labels to LED states:
  - 0 to 35: green
  - 36 to 65: yellow
  - 66 to 85: red
  - 86 to 100: blinking red
- Send or compute `led_state` consistently.
- Show the same state in the dashboard and stored readings.

### 2. Improve Sensor Quality

Goal: reduce invalid calibration and warm-up rows.

Tasks:

- Add a sensor warm-up period before saving data.
- Add finger-contact quality checks for the heart-rate signal.
- Add GSR baseline calibration per student/session.
- Mark readings as `high_confidence` or `low_confidence`.
- Store raw ADC values separately from processed BPM/GSR values.

### 3. Clean Session Labeling

Goal: make data useful for analysis and ML.

Tasks:

- Add session labels such as baseline, lecture, quiz, lab, and break.
- Add event markers like "quiz started" or "teacher changed topic".
- Export labeled CSV files for analysis.
- Record who/what was being measured without exposing names in public data.

### 4. Rebuild ML Artifacts Locally

Goal: keep GitHub clean while still allowing local ML testing.

Tasks:

- Keep datasets and model weights ignored by Git.
- Re-download or restore local datasets when needed.
- Run `ml_model/src/train_pipeline.py`.
- Regenerate:
  - `ml_model/models/scaler.pkl`
  - `ml_model/models/trackA_model.pt`
  - `ml_model/models/trackB_model.pkl`
- Keep only `feature_config.json` committed.

## Future Target Architecture

The long-term target is mobile-first and more secure:

```text
ESP32 sensor device -> BLE -> Mobile app -> HTTPS sync -> Laptop/cloud server
```

### Desired Flow

1. ESP32 advertises as a BioPulse BLE peripheral.
2. Mobile app connects as the BLE central/client.
3. Mobile app displays readings live without internet.
4. Mobile app stores session data locally.
5. When internet is available, the app syncs completed sessions to the server.
6. Server accepts only authenticated and authorized uploads.
7. Teacher/research dashboard shows allowed summaries and history.

## Future Upgrade Phases

### Phase 1: BLE Device Transport

Goal: replace direct ESP32-to-server WiFi streaming with phone-connected BLE.

Tasks:

- Convert ESP32 firmware from WebSocket client to BLE peripheral.
- Define a BioPulse BLE service.
- Add BLE characteristics for:
  - heart rate
  - GSR
  - HRV
  - temperature
  - humidity
  - battery/device status
  - stress/LED state
- Add BLE reconnect behavior.
- Keep local LED feedback working even if phone disconnects.

### Phase 2: Mobile BLE Integration

Goal: make the phone the live receiver.

Tasks:

- Add a Capacitor-compatible BLE plugin.
- Build scan, pair, connect, disconnect, and reconnect UI.
- Feed BLE readings into the existing stress context/state.
- Show connected, disconnected, reconnecting, and waiting-for-data states.
- Support device identity and battery level display.

### Phase 3: Offline Mobile Capture

Goal: make BioPulse usable without internet during a session.

Tasks:

- Add local phone storage for active and completed sessions.
- Store readings while offline.
- Add unsynced/synced status per session.
- Add retry-safe upload queue.
- Prevent duplicate uploads using stable session IDs.

### Phase 4: Authentication

Goal: protect biometric data before remote sync.

Recommended first option: Firebase Authentication.

Tasks:

- Add login and registration screens.
- Support email/password authentication.
- Store auth session securely on the phone.
- Attach authenticated user ID to synced sessions.
- Validate tokens on the server.
- Add logout and expired-session handling.

### Phase 5: Secure Server Sync

Goal: move from live-only ingestion to reliable session upload.

Tasks:

- Add authenticated session upload endpoints.
- Accept full session batches from the mobile app.
- Add idempotent upload behavior.
- Record sync timestamps and upload status.
- Use HTTPS/WSS for any non-local deployment.
- Reject unauthenticated uploads.

### Phase 6: Teacher / Laptop Dashboard

Goal: make the server useful for review, not just storage.

Tasks:

- Add a web dashboard for live classroom monitoring.
- Add filters by student, session, date, and activity.
- Add class-level trend charts.
- Add exportable reports.
- Add role-based access for teacher/research/admin views.

### Phase 7: Better ML and Analytics

Goal: move beyond fixed thresholds.

Tasks:

- Build per-student baselines.
- Train with labeled events and self-reported stress values.
- Evaluate with precision, recall, F1-score, and confusion matrix.
- Add anomaly detection for sustained high stress.
- Add recovery-time analysis after high-stress events.
- Add confidence score based on sensor quality.

### Phase 8: Security and Privacy Hardening

Goal: make the system safer for real biometric data.

Tasks:

- Use pseudonymous IDs instead of names in raw data.
- Encrypt sensitive local storage where practical.
- Add access rules so students see only their own data.
- Add teacher access only to consented summaries.
- Add audit logs for login, sync, export, delete, and admin actions.
- Add consent and data-retention controls.

### Phase 9: Long-Term Engineering Improvements

Tasks:

- Add OTA firmware update support.
- Add remote configuration for sampling rate and thresholds.
- Add multi-device support.
- Add battery and device health telemetry.
- Add backup and recovery for server data.
- Add automated tests for backend, mobile state, and ML preprocessing.

## Recommended Build Order

1. Add physical LED actuator support.
2. Improve sensor quality checks and calibration.
3. Add session labels and event markers.
4. Stabilize local ML artifact regeneration.
5. Move ESP32 transport from WiFi/WebSocket to BLE.
6. Add mobile offline session storage.
7. Add authentication.
8. Add secure mobile-to-server session sync.
9. Add teacher/laptop dashboard.
10. Improve ML with real labels and baseline calibration.

## Final Desired System Behavior

- The wearable streams to the phone over BLE.
- The phone shows live readings immediately.
- The phone saves sessions even without internet.
- The phone syncs completed sessions securely after login.
- The server stores only authorized biometric data.
- The dashboard supports live monitoring, history, analysis, and export.
- Stress scores are shown as indicators with confidence, not as medical diagnosis.

