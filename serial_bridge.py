import serial
import requests
import time
import json

SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200
URL = 'http://localhost:3001/api/data'

def main():
    print(f"Connecting to {SERIAL_PORT} at {BAUD_RATE} baud...")
    while True:
        try:
            with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2) as ser:
                print("Serial connected!")
                while True:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                    
                    if line.startswith('Timestamp') or line.startswith('rst:'):
                        continue
                        
                    parts = line.split(',')
                    if len(parts) >= 6:
                        try:
                            # 4179,25.00,40.90,0,0,0.0
                            timestamp_ms = int(parts[0])
                            temp_c = float(parts[1])
                            humidity_pct = float(parts[2])
                            bpm = int(parts[3])
                            raw_gsr = int(parts[4])
                            gsr_conductivity = float(parts[5])
                            
                            payload = {
                                "student_id": "S01",
                                "timestamp": int(time.time() * 1000),
                                "heart_rate": bpm,
                                "raw_gsr": raw_gsr,
                                "gsr_pct": gsr_conductivity,
                                "temperature": temp_c,
                                "humidity": humidity_pct
                            }
                            
                            try:
                                resp = requests.post(URL, json=payload, timeout=1)
                                print(f"Sent: {payload} | Status: {resp.status_code}")
                            except requests.RequestException as e:
                                print(f"Failed to send to server: {e}")
                            
                        except ValueError:
                            print(f"Failed to parse line: {line}")
                            
        except serial.SerialException as e:
            print(f"Serial error: {e}. Retrying in 2 seconds...")
            time.sleep(2)
        except Exception as e:
            print(f"Unexpected error: {e}")
            time.sleep(2)

if __name__ == '__main__':
    main()
