import requests
import json
import numpy as np
import time

def build_readings(count=60, interval_ms=1000):
    now = int(time.time() * 1000)
    readings = []

    for i in range(count):
        timestamp = now - (count - i) * interval_ms
        readings.append({
            "timestamp": timestamp,
            "heart_rate": float(np.random.normal(82, 6)),
            "hrv": float(np.random.normal(42, 8)),
            "gsr_pct": float(np.random.normal(38, 7)),
            "temperature": float(np.random.normal(28.5, 0.6)),
            "humidity": float(np.random.normal(62, 3)),
            "ibi_ms": float(np.random.normal(780, 50)),
        })

    return readings


payload = {"readings": build_readings()}

print("[*] Sending firmware-aligned rolling telemetry (60 readings) to /predict/live ...")
try:
    response = requests.post("http://localhost:8000/predict/live", json=payload)
    print("\n--- API Response ---")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error connecting to API:", e)
