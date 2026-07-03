#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="${DEVLOOP_SELF_DOGFOOD_BRANCH:-dogfood/failing-ci}"
BASE_BRANCH="${DEVLOOP_SELF_DOGFOOD_BASE:-main}"
FIXTURE_FILE="$ROOT/fixtures/self-dogfood/src/user.js"

fail() {
  echo "self-dogfood start failed: $*" >&2
  exit 1
}

cd "$ROOT"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "run this inside the DevLoop git repository"

current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$BASE_BRANCH" ]] || fail "expected branch $BASE_BRANCH, got ${current_branch:-detached}"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "working tree is dirty; commit or stash changes before creating the dogfood branch"
fi

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  fail "local branch $BRANCH already exists; run scripts/self-dogfood/reset.sh first"
fi

git switch -c "$BRANCH"

FIXTURE_FILE="$FIXTURE_FILE" node --input-type=commonjs <<'NODE'
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

echo "Introduced controlled self-dogfood failure in fixtures/self-dogfood."

set +e
npm --prefix fixtures/self-dogfood test
test_status=$?
set -e

if [[ "$test_status" -eq 0 ]]; then
  fail "expected fixtures/self-dogfood to fail after introducing the bug"
fi

git add fixtures/self-dogfood/src/user.js
git commit -m "test: add self-dogfood failing CI case"
git push -u origin "$BRANCH"

cat <<EOF

Self-dogfood branch pushed: $BRANCH

Next steps for GitHub App mode:
1. Open a pull request from $BRANCH into $BASE_BRANCH.
2. Wait for the "Self Dogfood Fixture" workflow to fail.
3. Comment on the PR:
   /devloop dry-run
   /devloop fix

Next steps for GitHub Action mode:
1. Configure the DevLoop autofix workflow to watch "Self Dogfood Fixture".
2. Let the action run on the failed workflow.
3. Confirm the generated PR includes diagnosis, patch, test result, sandbox info,
   firewall report, and evidence bundle summary.

Cleanup:
  ./scripts/self-dogfood/reset.sh
EOF
