#!/usr/bin/env bash
set -euo pipefail

# Usage:
# export GEMINI_API_KEY="your_gemini_key"
# export FIREBASE_PROJECT_ID="your_firebase_project_id"
# bash deploy-google-shell.sh

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "ERROR: GEMINI_API_KEY is missing"
  exit 1
fi

if [ -z "${FIREBASE_PROJECT_ID:-}" ]; then
  echo "ERROR: FIREBASE_PROJECT_ID is missing"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import os

p = Path('index.html')
html = p.read_text(encoding='utf-8')
key = os.environ['GEMINI_API_KEY']
html = html.replace('ضع_مفتاح_Gemini_هنا', key)
p.write_text(html, encoding='utf-8')
print('Gemini key injected into local index.html for deployment only.')
PY

if ! command -v firebase >/dev/null 2>&1; then
  npm install -g firebase-tools
fi

firebase deploy --only hosting --project "$FIREBASE_PROJECT_ID"
