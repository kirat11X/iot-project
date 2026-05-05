#include <Arduino.h>
#include "DHT.h"
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// Pin definitions for the current analog wiring.
#define DHT_PIN 26
#define DHT_TYPE DHT11
#define HEART_RATE_PIN 33
#define GSR_PIN 35

// Network and server config. Update these before flashing.
const char* WIFI_SSID = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* SERVER_IP = "192.168.1.100";
const int SERVER_PORT = 3001;
const char* STUDENT_ID = "S01";

const unsigned long SAMPLE_INTERVAL_MS = 1000;


DHT dht(DHT_PIN, DHT_TYPE);
WebSocketsClient wsClient;

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  (void)payload;
  (void)length;

  // Keep Serial output CSV-only. Connection state is intentionally silent.
  if (type == WStype_CONNECTED || type == WStype_DISCONNECTED) {
    return;
  }
}

int computeAnalogStressIndex(int rawHR, float gsrPercentage) {
  // This is an analog signal score, not a medical BPM-based stress model.
  const float hrSignal = constrain(rawHR / 4095.0f, 0.0f, 1.0f);
  const float gsrSignal = constrain(gsrPercentage / 100.0f, 0.0f, 1.0f);
  const float stress = (0.40f * hrSignal) + (0.60f * gsrSignal);
  return constrain((int)round(stress * 100.0f), 0, 100);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // We do not block here so that Serial data continues to stream
  // even if WiFi is unavailable.
}

void setup() {
  Serial.begin(115200);

  dht.begin();
  analogReadResolution(12);
  analogSetPinAttenuation(HEART_RATE_PIN, ADC_11db);
  analogSetPinAttenuation(GSR_PIN, ADC_11db);

  connectWiFi();

  wsClient.begin(SERVER_IP, SERVER_PORT, "/");
  wsClient.onEvent(webSocketEvent);
  wsClient.setReconnectInterval(3000);

  delay(1000);
  Serial.println("timestamp,heart_rate,hrv,gsr_pct,temperature,humidity,ibi_ms");
}

// Add these globals above loop()
unsigned long lastPeakTime   = 0;
unsigned long currentBPM     = 0;
unsigned long lastIBI        = 0;   // inter-beat interval in ms
float         hrvRMSSD       = 0;   // simplified HRV
unsigned long ibiBuf[8]      = {0}; // last 8 IBI values
int           ibiBufIdx      = 0;

// Peak detection threshold — tune this for your sensor
const int     PEAK_THRESHOLD = 2000;  // ADC value — adjust based on your readings
const int     MIN_BEAT_GAP   = 400;   // ms — prevents double-counting (max 150 BPM)
bool          peakDetected   = false;

void updateHeartRate(int rawHR) {
  unsigned long now = millis();
  
  // Simple threshold peak detector
  if (rawHR > PEAK_THRESHOLD && !peakDetected && 
      (now - lastPeakTime) > MIN_BEAT_GAP) {
    
    unsigned long ibi = now - lastPeakTime;   // time between beats
    lastPeakTime  = now;
    peakDetected  = true;

    if (ibi > 300 && ibi < 2000) {           // valid range: 30–200 BPM
      currentBPM = 60000 / ibi;              // convert IBI to BPM
      lastIBI    = ibi;

      // Store IBI in buffer for HRV
      ibiBuf[ibiBufIdx % 8] = ibi;
      ibiBufIdx++;

      // Compute RMSSD (simplified HRV) from last 8 beats
      if (ibiBufIdx >= 2) {
        float sumSq = 0;
        int   count = min((int)ibiBufIdx - 1, 7);
        for (int i = 0; i < count; i++) {
          float diff = (float)ibiBuf[(ibiBufIdx - 1 - i) % 8] - 
                       (float)ibiBuf[(ibiBufIdx - 2 - i) % 8];
          sumSq += diff * diff;
        }
        hrvRMSSD = sqrt(sumSq / count);
      }
    }
  }

  if (rawHR < PEAK_THRESHOLD - 200) {        // hysteresis — reset flag
    peakDetected = false;
  }
}

void loop() {
  wsClient.loop();

  unsigned long currentMillis = millis();
  
  // High-frequency polling for Heart Rate peak detection
  static unsigned long lastHrSample = 0;
  if (currentMillis - lastHrSample >= 20) { // ~50Hz sampling for accurate peaks
    lastHrSample = currentMillis;
    const int rawHR = analogRead(HEART_RATE_PIN);
    updateHeartRate(rawHR);
  }

  // Low-frequency transmission and slow sensors (DHT, GSR)
  static unsigned long lastSampleMs = 0;
  if (currentMillis - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = currentMillis;

    float humidity = dht.readHumidity();
    float tempC = dht.readTemperature();
    const int rawGSR = analogRead(GSR_PIN);

    if (isnan(humidity) || isnan(tempC)) {
      humidity = 0.0f;
      tempC = 0.0f;
    }

    // Convert GSR % to a normalized conductance value
    float gsrPct = (rawGSR / 4095.0) * 100.0;

    Serial.print(currentMillis);     Serial.print(",");
    Serial.print(currentBPM);        Serial.print(",");   // actual BPM
    Serial.print(hrvRMSSD, 1);       Serial.print(",");   // HRV in ms
    Serial.print(gsrPct, 1);         Serial.print(",");   // GSR %
    Serial.print(tempC, 1);          Serial.print(",");
    Serial.print(humidity, 1);       Serial.print(",");
    Serial.println(lastIBI);                              // raw IBI ms

    if (wsClient.isConnected()) {
      StaticJsonDocument<384> doc;
      doc["student_id"]  = STUDENT_ID;
      doc["timestamp"]   = currentMillis;
      doc["heart_rate"]  = currentBPM;          // actual BPM now
      doc["hrv"]         = (int)hrvRMSSD;       // RMSSD in ms
      doc["gsr"]         = gsrPct;              // GSR as percentage 0-100
      doc["temperature"] = tempC;
      doc["humidity"]    = humidity;
      doc["ibi_ms"]      = lastIBI;             // raw inter-beat interval
      doc["spo2"]        = 0;                   // hardcoded zero
      doc["stress_index"]= 0;                   // computed server-side

      String jsonStr;
      serializeJson(doc, jsonStr);
      wsClient.sendTXT(jsonStr);
    }
  }
}
