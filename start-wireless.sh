#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLASK_BIN="$ROOT_DIR/server/.venv/bin/python"
FLASK_APP="$ROOT_DIR/server/app.py"
FLASK_LOG="/tmp/ftc-pulse-flask.log"
NGROK_LOG="/tmp/ftc-pulse-ngrok.log"

FLASK_PID=""
NGROK_PID=""

cleanup() {
  echo ""
  echo "Shutting down FTC Pulse wireless environment..."
  if [[ -n "$NGROK_PID" ]] && kill -0 "$NGROK_PID" 2>/dev/null; then
    kill "$NGROK_PID" 2>/dev/null || true
  fi
  if [[ -n "$FLASK_PID" ]] && kill -0 "$FLASK_PID" 2>/dev/null; then
    kill "$FLASK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 1. Verify required tools
if [[ ! -x "$FLASK_BIN" ]]; then
  echo "Error: Python virtualenv not found at $FLASK_BIN"
  exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "Error: 'ngrok' is not installed or not on PATH."
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: 'npx' (Node.js) is not installed or not on PATH."
  exit 1
fi

# 2. Start Flask backend on port 5050 (or reuse if already running)
if curl -sf "http://127.0.0.1:5050/api/health" >/dev/null 2>&1; then
  echo "Flask server is already running on http://127.0.0.1:5050 (reusing existing process)."
else
  echo "Starting Flask backend on port 5050..."
  "$FLASK_BIN" "$FLASK_APP" >"$FLASK_LOG" 2>&1 &
  FLASK_PID=$!

  for i in $(seq 1 20); do
    if curl -sf "http://127.0.0.1:5050/api/health" >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "$FLASK_PID" 2>/dev/null; then
      echo "Error: Flask exited unexpectedly. Last log lines:"
      tail -n 20 "$FLASK_LOG"
      exit 1
    fi
    sleep 0.5
  done

  if ! curl -sf "http://127.0.0.1:5050/api/health" >/dev/null 2>&1; then
    echo "Error: Flask did not become healthy on port 5050. Check $FLASK_LOG"
    exit 1
  fi
  echo "Flask backend ready."
fi

# 3. Start ngrok tunnel for port 5050
echo "Starting ngrok tunnel for port 5050..."
ngrok http 5050 --log=stdout >"$NGROK_LOG" 2>&1 &
NGROK_PID=$!

NGROK_URL=""
for i in $(seq 1 30); do
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "Error: ngrok exited unexpectedly. Last log lines:"
    tail -n 20 "$NGROK_LOG"
    exit 1
  fi

  NGROK_URL="$("$FLASK_BIN" -c '
import json, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=1) as resp:
        data = json.load(resp)
    for t in data.get("tunnels", []):
        url = t.get("public_url", "")
        if url.startswith("https://"):
            print(url)
            break
except Exception:
    pass
')"

  if [[ -n "$NGROK_URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$NGROK_URL" ]]; then
  echo "Error: Could not obtain ngrok HTTPS URL. Check $NGROK_LOG"
  tail -n 20 "$NGROK_LOG"
  exit 1
fi

echo ""
echo "============================================================"
echo " FTC Pulse Wireless Mode Ready"
echo " Flask API (local) : http://127.0.0.1:5050"
echo " Flask API (ngrok) : $NGROK_URL"
echo " Flask logs        : $FLASK_LOG"
echo " ngrok logs        : $NGROK_LOG"
echo "============================================================"
echo ""

# 4. Launch Expo dev-client with tunnel and injected ngrok API URL
cd "$ROOT_DIR/app"
EXPO_PUBLIC_API_URL="$NGROK_URL" npx expo start --dev-client --tunnel
