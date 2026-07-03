#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/devloop-self-dogfood.XXXXXX")"
REPO_COPY="$WORKDIR/devloop-ai"
FIXTURE_PATH="$REPO_COPY/fixtures/self-dogfood"
LOG_FILE="$WORKDIR/self-dogfood-ci.log"

cleanup() {
  if [[ "${DEVLOOP_SELF_DOGFOOD_KEEP:-0}" != "1" ]]; then
    rm -rf "$WORKDIR"
  else
    echo "Self-dogfood workspace kept at: $WORKDIR"
  fi
}
trap cleanup EXIT

step() {
  printf '\n# %s\n' "$1"
}

step "Copying DevLoop into an isolated temp repo"
ROOT="$ROOT" REPO_COPY="$REPO_COPY" node --input-type=commonjs <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = process.env.ROOT;
const targetRoot = process.env.REPO_COPY;
const ignoredNames = new Set([
  '.git',
  '.devloop',
  'node_modules',
  'dist',
  'coverage',
  'benchmark-results',
  'firewallbench-results',
  '.cache',
  'tmp',
  'temp'
]);
const ignoredFiles = new Set(['.env', '.env.local', '.env.production']);

function shouldCopy(sourcePath) {
  const relative = path.relative(sourceRoot, sourcePath);
  if (!relative) {
    return true;
  }
  const parts = relative.split(path.sep);
  if (parts.some((part) => ignoredNames.has(part))) {
    return false;
  }
  const basename = path.basename(sourcePath);
  return !ignoredFiles.has(basename) && !basename.endsWith('.log');
}

fs.cpSync(sourceRoot, targetRoot, {
  recursive: true,
  filter: shouldCopy
});
NODE
echo "Temp repo: $REPO_COPY"

step "Installing and building DevLoop"
(cd "$REPO_COPY" && npm ci && npm run build)

step "Introducing the controlled self-dogfood failure"
FIXTURE_FILE="$FIXTURE_PATH/src/user.js" node --input-type=commonjs <<'NODE'
const fs = require('node:fs');

const file = process.env.FIXTURE_FILE;
const before = "const name = (user.name ?? 'Anonymous').trim();";
const after = "const name = user.name.trim();";
const source = fs.readFileSync(file, 'utf8');

if (!source.includes(before)) {
  throw new Error(`expected safe self-dogfood fixture line in ${file}`);
}

fs.writeFileSync(file, source.replace(before, after));
NODE

(cd "$REPO_COPY" && git init -q && git config core.autocrlf false && git add .)

step "Running tests before DevLoop"
set +e
(cd "$FIXTURE_PATH" && npm test 2>&1 | tee "$LOG_FILE")
test_status=${PIPESTATUS[0]}
set -e
if [[ "$test_status" -eq 0 ]]; then
  echo "Expected the self-dogfood fixture to fail, but it passed." >&2
  exit 1
fi

step "Previewing DevLoop autofix"
# Equivalent CLI shape: devloop autofix --dry-run --demo --no-pr
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GITHUB_TOKEN node "$REPO_COPY/dist/cli/index.js" autofix \
  --repo "$FIXTURE_PATH" \
  --log-file "$LOG_FILE" \
  --test-command "npm test" \
  --max-retries 1 \
  --dry-run \
  --no-pr \
  --demo

step "Applying DevLoop autofix"
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GITHUB_TOKEN node "$REPO_COPY/dist/cli/index.js" autofix \
  --repo "$FIXTURE_PATH" \
  --log-file "$LOG_FILE" \
  --test-command "npm test" \
  --max-retries 1 \
  --no-pr \
  --demo

step "Running tests after DevLoop"
(cd "$FIXTURE_PATH" && npm test)

step "Final git diff"
(cd "$REPO_COPY" && git diff -- fixtures/self-dogfood/src/user.js fixtures/self-dogfood/test/user.test.js)

step "Self-dogfood local demo complete"
echo "DevLoop repaired its own controlled failing fixture in an isolated temp repo."
