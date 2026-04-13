# 🧠 BioPulse — Biometric Stress Logging & Analysis System

> A wearable IoT system that physically validates classroom stress by tracking students' physiological responses in real time using an ESP32, GSR sensor, MAX30102 heart rate sensor, and a mobile React dashboard.

---

## 📌 Project Overview

**BioPulse** is a classroom stress monitoring system designed to give teachers and researchers objective, physiological evidence of student stress levels — rather than relying solely on self-reporting. Students wear a compact ESP32-based device that continuously reads their galvanic skin response (GSR) and heart rate/SpO2. The data is transmitted wirelessly and visualized on a mobile React application (converted to APK).

---

## 🎯 Problem Statement

Classroom atmosphere directly affects student learning outcomes, yet stress is rarely measured in any objective way. Teachers have no real-time visibility into whether students are overwhelmed during a lecture, quiz, or activity. This system provides physiological ground truth to support those decisions.

---

## 🔧 Hardware Components

| Component | Role | Notes |
|-----------|------|-------|
| **ESP32** | Microcontroller + WiFi/BT | Brain of the wearable device |
| **GSR Sensor** | Measures galvanic skin response | Electrodes placed on fingers |
| **MAX30102** | Heart rate + SpO2 sensor | I2C interface, optical sensor |
| **LED (RGB or 3-color)** | Visual stress indicator | Green / Yellow / Red feedback |
| **LiPo Battery** | Power supply | 3.7V, rechargeable |
| **3D Printed / Custom Enclosure** | Wearable form factor | Wristband or clip-on |

---

## 📡 System Architecture

```
┌──────────────────────────────────────────────┐
│              Wearable Device (ESP32)         │
│                                              │
│   GSR Sensor ──┐                             │
│                ├──► ESP32 ──► WiFi/BT ──────┼──► Mobile App (React)
│   MAX30102     │                             │   (Displays Data & Runs CSV Batches)
│   (Temp/Humid) └──► LED Indicator            │
└──────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Backend / API       │
                    │  (Node.js proxy)      │
                    └───────────┬───────────┘
                                │
                  ┌─────────────┴──────────────┐
                  ▼                            ▼
        ┌───────────────────┐        ┌───────────────────┐
        │ Local Storage DB  │        │ Python Fast API   │
        │ (SQLite)          │        │ (Track A/B ML)    │
        └───────────────────┘        └───────────────────┘
```

---

## 📱 Mobile Application

The mobile application is built in **React** and converted to an **Android APK** using Capacitor or a WebView wrapper.

### Core Screens

| Screen | Purpose |
|--------|---------|
| **Live Monitor** | Real-time stress gauge, BPM, GSR, SpO2, HRV |
| **History** | Past session logs, charts, exportable data |
| **Analysis** | Per-student radar chart + classroom heatmap |
| **Settings** | Device pairing, thresholds, profile config |

### Theme
Dark blue / purple / black — designed to feel like a medical-grade biometric dashboard.

```
Background:    #0A0A1A
Card Surface:  #0F1535
Accent:        #6C63FF (violet) + #3B82F6 (blue)
Stress High:   #EF4444 | Medium: #F59E0B | Low: #10B981
```

---

## 📊 Sensor Data & Stress Algorithm

### Raw Sensor Outputs

| Sensor | Output | Unit | Typical Range |
|--------|--------|------|---------------|
| GSR | Skin conductance | µS (microsiemens) | 2–20 µS |
| MAX30102 | Heart Rate | BPM | 55–110 BPM |
| MAX30102 | Blood Oxygen (SpO2) | % | 94–100% |

### Derived Metrics

- **HRV (Heart Rate Variability):** Calculated from inter-beat intervals. Lower HRV = higher stress.
- **Stress Index (0–100):** Composite score weighted from normalized GSR + HR + HRV values.

```
Stress Index = (0.45 × GSR_norm) + (0.35 × HR_norm) + (0.20 × HRV_inv_norm)
```

### LED Stress Mapping

| Stress Index | LED Color | State |
|---|---|---|
| 0–35 | 🟢 Green | Calm |
| 36–65 | 🟡 Yellow | Moderate |
| 66–85 | 🔴 Red | Stressed |
| 86–100 | 🔴 Blinking Red | Critical |

---

## 🗂️ Repository Structure

```
biopulse/
│
├── firmware/                   # ESP32 Arduino/PlatformIO code
│   ├── src/
│   │   ├── main.cpp            # Main loop
│   │   ├── gsr.cpp / gsr.h     # GSR sensor handler
│   │   ├── heartrate.cpp       # MAX30102 handler
│   │   ├── wifi_handler.cpp    # WiFi + WebSocket client
│   │   └── led_control.cpp     # LED stress indicator logic
│   └── platformio.ini
│
├── backend/                    # Data relay & API
│   ├── server.js               # WebSocket + REST API
│   ├── db/
│   │   └── sessions.db         # SQLite database
│   └── routes/
│       ├── sessions.js
│       └── students.js
│
├── mobile-app/                 # React mobile app
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StressGauge.jsx
│   │   │   ├── VitalsCard.jsx
│   │   │   ├── SessionChart.jsx
│   │   │   ├── HeatmapGrid.jsx
│   │   │   └── RadarChart.jsx
│   │   ├── screens/
│   │   │   ├── LiveMonitor.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Analysis.jsx
│   │   │   └── Settings.jsx
│   │   ├── context/
│   │   │   └── StressContext.jsx
│   │   ├── hooks/
│   │   │   ├── useESP32Data.js
│   │   │   └── useMockData.js
│   │   ├── utils/
│   │   │   └── stressAlgorithm.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── docs/
│   ├── circuit_diagram.png
│   ├── system_architecture.png
│   └── sensor_calibration.md
│
├── README.md
└── plan.md
```

---

## ⚙️ Setup & Installation

### 1. Flash ESP32 Firmware

```bash
cd firmware
# Install PlatformIO CLI or use PlatformIO IDE extension in VSCode
pio run --target upload
```

Configure your WiFi credentials and backend IP in `firmware/src/wifi_handler.cpp`:
```cpp
const char* SSID = "YourNetwork";
const char* PASSWORD = "YourPassword";
const char* SERVER_IP = "192.168.x.x";
```

### 2. Run the Backend

```bash
cd backend
npm install
node server.js
# Runs on port 3001 by default
```

### 3. Run the Mobile App (Development)

```bash
cd mobile-app
npm install
npm run dev
# Open in browser at localhost:5173
```

### 4. Build APK

```bash
# Using Capacitor
npm run build
npx cap add android
npx cap sync
npx cap open android
# Then build APK from Android Studio
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Microcontroller | ESP32 (Arduino framework / PlatformIO) |
| Firmware libs | `MAX30105.h`, `Wire.h`, `WiFi.h`, `WebSocketsClient.h` |
| Backend | Node.js + Express + WebSocket (`ws`) + SQLite (`better-sqlite3`) |
| ML Integration | Python FastAPI endpoint proxies |
| Frontend | React 18 + Vite + Inline Dynamic Scaling |
| Charts | Recharts |
| State | React Context + useReducer |
| APK Build | Capacitor Native Android wrapper (`npx cap sync`) |

---

## 🚀 Future Roadmap & Upgrades

While the initial build relied on ESP32 → Server (via WiFi) telemetry bridging, the planned target architecture focuses heavily on mobile-first portability and security:

1. **Bluetooth (BLE) Migration:** Shift from WiFi/Websockets directly to a secure BLE bond between the ESP32 and the user's phone, blocking direct unauthenticated internet hooks to the hardware.
2. **Offline Queuing:** The Mobile App natively caches sessions indefinitely and syncs to the server only when the internet connects.
3. **Firebase Authentication:** Force strict login logic mapping unique hardware identifiers to individual student profiles.
4. **Machine Learning Pipeline:** Finalize data collection leading into the Fast API Tracks A & B deployments for advanced anomaly detection and personalized baselines.

*(For detailed execution tracking spanning the BLE shift & Auth modules, view `upgrade.md`)*

---

## 👤 Authors

- **[Your Name]** — Hardware, Firmware, System Design
- **[Team Member]** — Mobile App, Backend

---

## 📄 License

MIT License — free to use for academic and research purposes.

---

## 🏫 Use Case — Classroom Validation

This system can be deployed in a classroom to:
- Identify the most stressful moments during a lecture or exam
- Compare physiological stress across different teaching methods
- Provide teachers with a session report after each class
- Support research papers on classroom atmosphere and student wellbeing

> **Note:** All student data is anonymized in the Analysis screen. The system is intended for research and improvement purposes only, with student consent.