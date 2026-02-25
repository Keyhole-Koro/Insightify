#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/Insightify

if [ -f Makefile ]; then
  echo "[workspace-init] Installing project dependencies..."
  make install
else
  echo "[workspace-init] Makefile not found. Skipping dependency install."
fi

echo "[workspace-init] Environment is ready."
exec sleep infinity
