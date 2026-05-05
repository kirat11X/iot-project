import pandas as pd
import numpy as np
import time

CSV_PATH = '/home/kirat/coding/iot/project/biopulse/backend/db/readings.csv'
df = pd.read_csv(CSV_PATH)
last_ts = int(time.time() * 1000)

rows = []
# Moderate
for i in range(500):
    rows.append({
        'id': '', 'session_id': '', 'student_id': 'S01',
        'timestamp': last_ts + i*2000,
        'heart_rate': np.random.randint(85, 110),
        'gsr': np.random.uniform(5.0, 7.0),
        'hrv': np.random.randint(20, 35),
        'stress_index': '', 'led_state': '',
        'temperature': 25, 'humidity': 41,
        'ibi_ms': 600, 'ml_stress_label': '', 'ml_confidence': '', 'ml_stress_index': '', 'received_at': ''
    })
# Stressed
for i in range(500):
    rows.append({
        'id': '', 'session_id': '', 'student_id': 'S01',
        'timestamp': last_ts + 1000000 + i*2000,
        'heart_rate': np.random.randint(110, 140),
        'gsr': np.random.uniform(7.0, 9.0),
        'hrv': np.random.randint(10, 20),
        'stress_index': '', 'led_state': '',
        'temperature': 25, 'humidity': 41,
        'ibi_ms': 500, 'ml_stress_label': '', 'ml_confidence': '', 'ml_stress_index': '', 'received_at': ''
    })
# Critical
for i in range(500):
    rows.append({
        'id': '', 'session_id': '', 'student_id': 'S01',
        'timestamp': last_ts + 2000000 + i*2000,
        'heart_rate': np.random.randint(140, 190),
        'gsr': np.random.uniform(9.0, 12.0),
        'hrv': np.random.randint(5, 10),
        'stress_index': '', 'led_state': '',
        'temperature': 25, 'humidity': 41,
        'ibi_ms': 400, 'ml_stress_label': '', 'ml_confidence': '', 'ml_stress_index': '', 'received_at': ''
    })

df_synth = pd.DataFrame(rows)
df_final = pd.concat([df, df_synth], ignore_index=True)
df_final.to_csv(CSV_PATH, index=False)
print("Added synthetic balanced data to readings.csv!")
