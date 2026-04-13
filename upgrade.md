# BioPulse Upgrade Roadmap

This document tracks the next major upgrades planned for BioPulse.

## New Target Pipeline

```text
IoT Sensor Device -> Mobile App (Bluetooth) -> Laptop / Web Server (Internet)
```

### Intended Flow
- The ESP32 wearable should no longer push data directly over WiFi to the backend.
- The IoT device should run only when it is paired and connected to the mobile app through Bluetooth.
- The mobile app becomes the primary gateway:
  - receives sensor data from the ESP32 over Bluetooth
  - displays live readings locally
  - stores readings safely on the phone
  - uploads readings to the laptop/server when internet is available
- The laptop/web server becomes the remote collector for synced mobile data, not the direct receiver from the ESP32.

## Upgrade 1: Bluetooth-Only IoT to Mobile Connection

### Goal
Move the sensor pipeline from direct WiFi/WebSocket transmission to Bluetooth communication between ESP32 and the mobile app.

### Planned Changes
- Replace ESP32 WiFi streaming logic with Bluetooth Low Energy (BLE) communication.
- Expose sensor readings from the ESP32 through BLE services/characteristics.
- Make the mobile app scan, pair, and connect to the BioPulse device.
- Allow the mobile app to start and stop data sessions from the phone.
- Keep live monitoring functional even without internet, as long as Bluetooth is connected.

### Expected Result
- The wearable only works when connected to the phone.
- The phone becomes the trusted bridge between the wearable and the server.

## Upgrade 2: Security and No Data Leakage

### Goal
Protect biometric data across device pairing, local storage, transmission, and server sync.

### Planned Security Upgrades
- Use secure Bluetooth pairing and restrict data exchange to the paired mobile device.
- Remove any unnecessary direct public exposure from the IoT device.
- Store data on the mobile app with minimal retention and protected local persistence.
- Send synced data from mobile to server only over HTTPS.
- Require authenticated requests from the mobile app to the server.
- Avoid storing unnecessary personally identifying data in plain form where possible.
- Add clear ownership rules so one user only sees their own data unless admin access is explicitly allowed.
- Log sync/access events on the server for traceability.

### Security Principles
- No direct ESP32-to-public-server communication.
- No open unauthenticated sync endpoint.
- No unnecessary sharing of raw biometric data between users.

## Upgrade 3: Login System

### Goal
Add user authentication so data is tied to a signed-in user and protected from unauthorized access.

### Current Direction
- Tentative choice: Firebase Authentication.

### Why Firebase Is a Good First Option
- Fast to integrate with mobile/web flows.
- Supports email/password and Google sign-in.
- Can issue user identity tokens for secure server requests.
- Reduces the amount of custom auth code needed early on.

### Planned Changes
- Add login and registration screens in the mobile app.
- Store the authenticated user session securely on the phone.
- Attach the user identity to uploaded readings and sessions.
- Validate auth tokens on the laptop/server before accepting uploaded data.
- Support logout and session expiration handling.

### Expected Result
- Each dataset is linked to a known authenticated user.
- Sync to the server is blocked unless the mobile app is signed in.

## Upgrade 4: Laptop / Web Server Data Capture

### Goal
Allow the laptop/server to receive data from the mobile app whenever the phone has internet access.

### Planned Changes
- Build a server API that accepts uploaded session data from the mobile app.
- Make the mobile app queue readings locally while offline.
- Sync queued data automatically when internet becomes available.
- Support session-based uploads instead of requiring every reading to be streamed live.
- Allow the laptop/server to store historical sessions for dashboard/report use.

### Expected Result
- BioPulse still works offline between IoT and phone.
- Internet is only needed for phone-to-server sync.
- The laptop/server becomes a reliable long-term data store and monitoring endpoint.

## Proposed Architecture After Upgrade

### Device Layer
- ESP32 + sensors
- BLE peripheral mode
- No direct backend communication

### Mobile Layer
- BLE client for live sensor capture
- Local buffering and session storage
- Login/auth state
- Secure uploader to server

### Server Layer
- Authenticated API
- Session/readings database
- Web dashboard or monitoring interface on laptop/server

## Upgrade Order

1. Convert ESP32 -> mobile transport from WiFi/WebSocket to Bluetooth BLE.
2. Add mobile-side local capture and offline session buffering.
3. Add login system, preferably with Firebase Authentication first.
4. Build secure server upload endpoints for phone -> laptop/server sync.
5. Harden security rules to prevent leakage and unauthorized access.
6. Add web/laptop dashboard features on top of the synced server data.

## Phase 2: Recommended Additional Upgrades

These are the best follow-up upgrades after the core Bluetooth + login + sync architecture is in place.

### Priority A: Build Next
- **BLE auto-reconnect and session resume**
  - If Bluetooth drops briefly, the mobile app should reconnect automatically and continue the session cleanly.
- **Offline sync queue with retry**
  - Store unsent sessions safely on the phone and upload them later when internet becomes available.
- **Unique device identity**
  - Give each ESP32 a unique device ID and bind it to a specific user, class, or project deployment.
- **Sensor quality validation**
  - Detect bad finger placement, noisy signals, impossible readings, or disconnected sensors before saving/uploading data.
- **Battery and device health monitoring**
  - Show battery level, connection strength, last-seen timestamp, and device online/offline state in the mobile app.

### Priority B: Strong Product Upgrades
- **Teacher/laptop dashboard**
  - Add a web dashboard for live classroom view, session monitoring, and post-session review.
- **Session labels and event markers**
  - Allow sessions to be tagged as lecture, quiz, exam, lab, or break, and let teachers add timeline notes like "quiz started".
- **Alert system**
  - Notify when stress stays high for a sustained period instead of reacting only to single spikes.
- **Export and reporting improvements**
  - Add PDF summaries, richer CSV exports, and class-level trend reports.

### Priority C: Security and Privacy Hardening
- **Role-based access**
  - Separate student, teacher, researcher, and admin access.
- **Encryption at rest**
  - Protect stored biometric data on both mobile and server.
- **Audit logs**
  - Record login, sync, export, delete, and admin actions.
- **Consent and retention controls**
  - Add explicit consent records, retention windows, and delete-my-data flows.

### Priority D: Smarter Analysis
- **Per-student baseline calibration**
  - Build each student's normal baseline before interpreting stress levels.
- **Personalized stress scoring**
  - Move beyond fixed thresholds and adapt scoring based on history.
- **Trend and anomaly detection**
  - Detect sustained overload, unusual spikes, and recovery time patterns.
- **Data confidence scoring**
  - Label sessions/readings as high-confidence or low-confidence based on sensor quality.

### Priority E: Long-Term Engineering Improvements
- **OTA firmware updates**
  - Update ESP32 firmware remotely without manual reflashing.
- **Remote configuration**
  - Push sampling rate, thresholds, and sync settings from the server.
- **Background sync service**
  - Keep uploads working even when the app is minimized.
- **Backup and recovery**
  - Add automatic backups for synced server data.
- **Multi-device support**
  - Support multiple phones/devices syncing into the same laptop/server environment.

## Final Desired System Behavior

- The wearable starts sending data only after the phone connects through Bluetooth.
- The phone shows live stress data immediately.
- The phone keeps data safely even when there is no internet.
- When the phone gets internet access, it uploads the stored sessions to the laptop/server.
- The server stores only authenticated, authorized, and protected data.
