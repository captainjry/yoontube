#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

export PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${PATH:-}"

if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-${HOME:-}/.nvm}"

  if [ -n "${HOME:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'npm was not found. Install Node in a system path or initialize nvm for cron.' >&2
  exit 1
fi

npm run sync
