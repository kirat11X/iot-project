# BioPulse — Next Execution Plan

> This plan replaces the old direct WiFi/WebSocket architecture with the new target pipeline:

```text
IoT Sensor Device -> Mobile App (Bluetooth) -> Laptop / Web Server (Internet)
```

---

## ✅ Current Baseline

The following baseline already exists in the repo:

- [x] React mobile app with Live Monitor, History, Analysis, and Settings
- [x] Stress scoring and chart components
- [x] Local mock/live app state flow
- [x] Node.js backend with SQLite session storage
- [x] History session summaries, CSV export, and reset flow
- [x] Capacitor-based Android packaging setup

What changes now is the system architecture:

- [ ] ESP32 should stop sending directly to the backend over WiFi
- [ ] Mobile app should become the primary gateway
- [ ] Bluetooth should become the only live device link
- [ ] Server should receive data from the phone, not the ESP32
- [ ] Auth and security should be added before cloud/server sync is trusted

---

## 🎯 Main Product Direction

### Core Decisions
- The IoT wearable runs only when paired with the phone through Bluetooth.
- The phone is the trusted bridge between the wearable and the server.
- Internet is required only for phone-to-server sync, not for local sensing.
- User authentication should be added before long-term remote sync is enabled.
- Firebase Authentication is the preferred first auth option unless requirements change later.

### Final Desired Behavior
- The ESP32 connects to the mobile app over BLE.
- The mobile app displays live readings instantly.
- The mobile app stores sessions locally when offline.
- When internet is available, the phone syncs sessions securely to the laptop/server.
- The server stores only authenticated, authorized, protected biometric data.

---

## 🏗️ Target Architecture

### Device Layer
- ESP32 in BLE peripheral mode
- GSR + MAX30102 sensors sampled locally
- BLE characteristics for:
  - heart rate
  - SpO2
  - GSR
  - HRV
  - stress index
  - battery/device status
- No direct backend or public network communication from the ESP32

### Mobile Layer
- Capacitor mobile app as BLE central/client
- Local session manager and offline queue
- Secure local persistence for unsynced sessions
- Login/auth state
- HTTPS sync client for server uploads

### Server Layer
- Authenticated API
- Session/readings database
- Sync/audit logging
- Laptop/web dashboard for review and monitoring

---

## 🚀 Now

These are the immediate upgrades to build first.

## Phase 1 — BLE Device Transport

**Goal:** Replace direct ESP32 WiFi/WebSocket streaming with Bluetooth Low Energy.

### Tasks
- [ ] Move firmware transport from WiFi/WebSocket to BLE.
- [ ] Define one BioPulse BLE service with characteristics for live telemetry and device status.
- [ ] Add ESP32 pairing/advertising behavior so the phone can discover only the BioPulse device.
- [ ] Ensure the device starts streaming only after a phone is connected.
- [ ] Add reconnection handling if the BLE link drops.
- [ ] Keep LED stress indication working on-device even when the phone disconnects.

### Deliverable
- ESP32 streams live telemetry to the mobile app only over Bluetooth.

## Phase 2 — Mobile BLE Integration

**Goal:** Make the mobile app the primary live receiver of sensor data.

### Tasks
- [ ] Add BLE support in the Capacitor app.
- [ ] Build scan, pair, connect, disconnect, and reconnect flows in Settings.
- [ ] Replace the current live WebSocket-first device path with BLE-first ingestion.
- [ ] Feed BLE readings into the existing mobile state/store and UI.
- [ ] Show device status:
  - connected
  - disconnected
  - reconnecting
  - waiting for data
- [ ] Add battery level and device identity display in the app.

### Deliverable
- The phone can connect to the wearable and drive the Live Monitor directly over BLE.

## Phase 3 — Mobile Offline Capture

**Goal:** Make live sensing work without internet.

### Tasks
- [ ] Create a local session model on the phone.
- [ ] Store readings locally while the session is active.
- [ ] Persist completed sessions safely when offline.
- [ ] Add an unsynced/synced status per session.
- [ ] Support retry-safe local buffering if the app loses internet.

### Deliverable
- BioPulse works locally between wearable and phone even without any internet connection.

---

## ⏭️ Next

These come right after BLE capture is working reliably.

## Phase 4 — Login System

**Goal:** Require user authentication before cloud/server sync.

### Direction
- Preferred first choice: Firebase Authentication

### Tasks
- [ ] Add login and registration flows in the mobile app.
- [ ] Support at least email/password authentication.
- [ ] Securely persist auth session/token on the mobile device.
- [ ] Link uploaded sessions to the authenticated user.
- [ ] Add logout flow and expired-session handling.

### Deliverable
- Users must sign in before their data is allowed to sync to the server.

## Phase 5 — Secure Mobile-to-Server Sync

**Goal:** Upload session data from phone to laptop/server when internet is available.

### Tasks
- [ ] Create authenticated server endpoints for session upload.
- [ ] Add session sync queue on the mobile app.
- [ ] Upload completed sessions over HTTPS.
- [ ] Retry failed uploads automatically without duplicating sessions.
- [ ] Record sync timestamps and sync status.
- [ ] Prevent unauthenticated or invalid uploads.

### Deliverable
- The phone syncs local sessions to the server securely and reliably.

## Phase 6 — Security Hardening

**Goal:** Prevent biometric data leakage and unauthorized access.

### Tasks
- [ ] Restrict BLE data access to the paired mobile device.
- [ ] Minimize personally identifying data stored in plain form.
- [ ] Encrypt stored data where practical on mobile and server.
- [ ] Add ownership rules so users only access their own records unless elevated access is intended.
- [ ] Add audit logging for:
  - login
  - sync
  - export
  - delete
  - admin actions
- [ ] Ensure all remote communication is HTTPS only.

### Deliverable
- The system has basic real-world security controls suitable for protected biometric data.

---

## 📈 Later

These upgrades increase product quality, scale, and long-term value after the core architecture is stable.

## Phase 7 — Teacher / Laptop Dashboard

**Goal:** Provide a server-side interface for monitoring and reviewing synced data.

### Tasks
- [ ] Build a laptop/web dashboard for live and historical session review.
- [ ] Add session search, filters, and summaries.
- [ ] Show student-level and class-level analytics.
- [ ] Add role-based access for teacher/research/admin views.

### Deliverable
- The laptop/server becomes a real monitoring and reporting interface, not just a raw data receiver.

## Phase 8 — Reliability and Device Operations

### Tasks
- [ ] BLE auto-reconnect and session resume
- [ ] unique device ID and provisioning flow
- [ ] battery and device health telemetry
- [ ] sensor quality checks for noisy or invalid readings
- [ ] remote configuration of thresholds and sampling rate
- [ ] OTA firmware update support

### Deliverable
- Devices are easier to manage, more reliable, and safer to deploy repeatedly.

## Phase 9 — Better Analytics

### Tasks
- [ ] baseline calibration per student
- [ ] personalized stress scoring
- [ ] trend and anomaly detection
- [ ] data confidence scoring
- [ ] session labels and teacher event markers
- [ ] stronger PDF/CSV/report generation

### Deliverable
- Analytics become more personalized, explainable, and useful for real classroom/research scenarios.

---

## 🧪 Acceptance Checklist

The new architecture is considered successfully implemented when all of the following are true:

- [ ] ESP32 streams only over BLE, not direct WiFi/WebSocket to the backend
- [ ] Mobile app can pair and reconnect to the device reliably
- [ ] Live Monitor works from BLE data without internet
- [ ] Sessions are stored locally on the phone
- [ ] Users can log in before sync
- [ ] Synced sessions reach the server securely over HTTPS
- [ ] Server rejects unauthenticated uploads
- [ ] Data remains visible locally if internet is unavailable
- [ ] Laptop/server can review synced sessions afterward

---

## ⚠️ Main Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| BLE instability on Android devices | High | Add auto-reconnect, reconnect UI states, and session resume logic |
| Sensor noise or poor finger contact | High | Add signal-quality validation before save/sync |
| Offline queue corruption or duplicate uploads | Medium | Use stable session IDs and idempotent upload handling |
| Auth complexity slowing delivery | Medium | Start with Firebase Auth instead of custom auth |
| Sensitive biometric data exposure | High | Use HTTPS, auth validation, storage protection, and access controls |

---

## 🗂️ Recommended Implementation Order

1. Firmware BLE transport
2. Mobile BLE connection flow
3. Mobile local session persistence
4. Mobile offline sync queue
5. Firebase login/auth
6. Secure server upload API
7. Security hardening and audit logs
8. Laptop/web dashboard
9. Reliability and analytics upgrades

---

## 📌 Short Version

**Now:** BLE + mobile local capture  
**Next:** login + secure sync to laptop/server  
**Later:** dashboard + stronger security + smarter analytics

---

*Last updated: April 2026 | Updated for Bluetooth-first BioPulse architecture*
