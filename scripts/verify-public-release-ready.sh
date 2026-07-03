#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

fail() {
  echo "release readiness failed: $*" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "missing required file: $1"
}

require_dir() {
  [[ -d "$1" ]] || fail "missing required directory: $1"
}

echo "== DevLoop public alpha readiness check =="

echo "Checking required files..."
for file in \
  README.md \
  LICENSE \
  SECURITY.md \
  CONTRIBUTING.md \
  CODE_OF_CONDUCT.md \
  CHANGELOG.md \
  ROADMAP.md \
  .env.example \
  .devloop.yml.example \
  .devloop-policy.yml.example \
  .devloop-mcp.json.example \
  .devloop-agents.yml.example \
  docs/security-model.md \
  docs/self-hosting.md \
  docs/github-app.md \
  docs/mcp.md \
  docs/evidence-bundles.md \
  docs/agent-firewall.md \
  docs/launch.md \
  docs/first-github-push.md
do
  require_file "$file"
done

echo "Checking examples..."
for dir in \
  examples/github-action \
  examples/github-app \
  examples/mcp \
  examples/security-autofix \
  examples/codex-skill
do
  require_dir "$dir"
done

echo "Checking package metadata..."
node -e "const p=require('./package.json'); if(!p.name||!p.version||!p.bin?.devloop||!p.license) process.exit(1)"
node -e "const p=require('./package.json'); if(!/^0\\.1\\.0-alpha\\.0$/.test(p.version)) process.exit(1)"

echo "Checking README launch sections..."
grep -q "30-second Local Demo" README.md || fail "README missing 30-second demo"
grep -q "Quick Links" README.md || fail "README missing quick links"
grep -q "Agent Firewall" README.md || fail "README missing Agent Firewall"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Checking tracked secret/local files..."
  tracked_sensitive="$(git ls-files | grep -E '(^|/)(\\.env|\\.env\\.local|\\.env\\.production|node_modules/|coverage/|benchmark-results/|firewallbench-results/|\\.devloop/|.*\\.sqlite3?$|.*\\.db$)' || true)"
  [[ -z "$tracked_sensitive" ]] || fail "sensitive or local artifacts are tracked: $tracked_sensitive"
else
  echo "Not inside a git repository; skipping tracked-file check."
fi

echo "Running lint..."
npm run lint

echo "Running typecheck..."
npm run typecheck

echo "Running tests..."
npm test

echo "Running build..."
npm run build

echo "Public alpha readiness check passed."
