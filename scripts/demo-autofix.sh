#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/fixtures/failing-node-repo"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/devloop-demo.XXXXXX")"
LOG_FILE="$WORKDIR/ci.log"

cleanup() {
  if [[ "${KEEP_DEVLOOP_DEMO:-0}" != "1" ]]; then
    rm -rf "$WORKDIR"
  else
    echo "Demo workspace kept at: $WORKDIR"
  fi
}
trap cleanup EXIT

step() {
  printf '\n# %s\n' "$1"
}

step "Building DevLoop"
(cd "$ROOT" && npm run build)

step "Preparing failing fixture"
cp -R "$FIXTURE/." "$WORKDIR/"
(cd "$WORKDIR" && git init -q && git config core.autocrlf false && npm install)
(cd "$WORKDIR" && git add .)
echo "Demo workspace: $WORKDIR"

step "Running tests before DevLoop"
set +e
(cd "$WORKDIR" && npm test 2>&1 | tee "$LOG_FILE")
TEST_STATUS=${PIPESTATUS[0]}
set -e
if [[ "$TEST_STATUS" -eq 0 ]]; then
  echo "Expected the fixture test to fail, but it passed."
  exit 1
fi

step "Previewing DevLoop autofix"
# Equivalent CLI shape: devloop autofix --dry-run --demo
node "$ROOT/dist/cli/index.js" autofix \
  --repo "$WORKDIR" \
  --log-file "$LOG_FILE" \
  --test-command "npm test" \
  --max-retries 1 \
  --dry-run \
  --no-pr \
  --demo

step "Applying DevLoop autofix"
node "$ROOT/dist/cli/index.js" autofix \
  --repo "$WORKDIR" \
  --log-file "$LOG_FILE" \
  --test-command "npm test" \
  --max-retries 1 \
  --no-pr \
  --demo

step "Running tests after DevLoop"
(cd "$WORKDIR" && npm test)

step "Final git diff"
(cd "$WORKDIR" && git diff -- src test package.json)

step "Demo complete"
echo "DevLoop fixed the failing test and left a minimal patch."
