import requests
import json
import time

readings = []
for i in range(30):
    readings.append({
        "timestamp": int(time.time()*1000) - (30-i)*1000,
        "heart_rate": 160,
        "hrv": 8,
        "gsr_pct": 11.5,
        "temperature": 25.0,
        "humidity": 40.0,
        "ibi_ms": 300
    })

resp = requests.post("http://localhost:8000/predict/live", json={"readings": readings})
print(resp.json())
