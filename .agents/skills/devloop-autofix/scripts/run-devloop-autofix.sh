#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LOG_FILE:-}" ]]; then
  echo "LOG_FILE is required." >&2
  exit 2
fi

if [[ -z "${TEST_COMMAND:-}" ]]; then
  echo "TEST_COMMAND is required." >&2
  exit 2
fi

REPO_PATH="${REPO_PATH:-.}"
MAX_RETRIES="${MAX_RETRIES:-3}"

devloop diagnose --repo "$REPO_PATH" --log-file "$LOG_FILE"

devloop autofix \
  --repo "$REPO_PATH" \
  --log-file "$LOG_FILE" \
  --test-command "$TEST_COMMAND" \
  --max-retries "$MAX_RETRIES" \
  --dry-run \
  --no-pr

if [[ "${APPLY:-0}" == "1" ]]; then
  devloop autofix \
    --repo "$REPO_PATH" \
    --log-file "$LOG_FILE" \
    --test-command "$TEST_COMMAND" \
    --max-retries "$MAX_RETRIES" \
    --no-pr
else
  echo "Dry-run complete. Set APPLY=1 after reviewing the patch preview."
fi
