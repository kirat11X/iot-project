#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/biopulse/backend"
MOBILE_DIR="$ROOT_DIR/biopulse/mobile-app"
ML_DIR="$ROOT_DIR/ml_model"

for cmd in node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: '$cmd' is required but not installed."
    exit 1
  fi
done

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "Error: backend folder not found at $BACKEND_DIR"
  exit 1
fi

if [[ ! -d "$MOBILE_DIR" ]]; then
  echo "Error: mobile app folder not found at $MOBILE_DIR"
  exit 1
fi

install_if_missing() {
  local dir="$1"
  if [[ ! -d "$dir/node_modules" ]]; then
    echo "Installing dependencies in $dir"
    (cd "$dir" && npm install)
  fi
}

stop_process() {
  local pid="$1"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
}

cleanup() {
  echo
  echo "Stopping services..."
  stop_process "${ML_PID:-}"
  stop_process "${MOBILE_PID:-}"
  stop_process "${BACKEND_PID:-}"
  stop_process "${BRIDGE_PID:-}"
}

trap cleanup EXIT INT TERM

install_if_missing "$BACKEND_DIR"
install_if_missing "$MOBILE_DIR"

echo "Starting backend on http://localhost:3001"
(
  cd "$BACKEND_DIR"
  node server.js
) &
BACKEND_PID=$!

echo "Starting mobile app on http://localhost:5173"
(
  cd "$MOBILE_DIR"
  npm run dev -- --host 0.0.0.0 --port 5173
) &
MOBILE_PID=$!

if [[ "${START_ML:-0}" == "1" ]]; then
  if [[ -f "$ML_DIR/src/api.py" ]] && command -v python3 >/dev/null 2>&1; then
    echo "Starting ML API on http://localhost:8000"
    (
      cd "$ML_DIR/src"
      if [[ -f "../venv2/bin/python" ]]; then
        ../venv2/bin/python -m uvicorn api:app --host 0.0.0.0 --port 8000
      else
        python3 -m uvicorn api:app --host 0.0.0.0 --port 8000
      fi
    ) &
    ML_PID=$!
  else
    echo "START_ML=1 was set, but ml/src/api.py or python3 is missing. Skipping ML API startup."
  fi
fi

if [[ -e "/dev/ttyUSB0" || -e "/dev/ttyACM0" ]]; then
  echo "Serial device detected. Starting Serial Bridge script..."
  (
    cd "$ROOT_DIR"
    if [[ ! -f "$ROOT_DIR/serial_bridge.py" ]]; then
      echo "Warning: serial_bridge.py not found at $ROOT_DIR"
    else
      python3 serial_bridge.py
    fi
  ) &
  BRIDGE_PID=$!
fi

echo
if [[ -n "${ML_PID:-}" ]]; then
  echo "All services are running:"
  echo "- Backend:   http://localhost:3001"
  echo "- Mobile:    http://localhost:5173"
  echo "- ML API:    http://localhost:8000"
else
  echo "Core services are running:"
  echo "- Backend:   http://localhost:3001"
  echo "- Mobile:    http://localhost:5173"
  echo "- ML API:    disabled (set START_ML=1 to enable)"
fi

echo

echo "Press Ctrl+C to stop everything."

wait
