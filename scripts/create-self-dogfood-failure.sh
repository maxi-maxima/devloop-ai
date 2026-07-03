#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must be run inside the DevLoop git repository." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is dirty. Commit or stash changes before creating a self-dogfood branch." >&2
  exit 1
fi

branch="${1:-devloop/self-dogfood-failure-$(date +%Y%m%d%H%M%S)}"
test_file="src/self-dogfood-failure.test.ts"

git checkout -b "$branch"

cat > "$test_file" <<'EOF'
import { describe, expect, test } from 'vitest';

describe('self-dogfood failure fixture', () => {
  test('intentionally fails so DevLoop can repair a CI branch', () => {
    expect('ci failed').toBe('ci fixed');
  });
});
EOF

git add "$test_file"
git commit -m "test: add self-dogfood failing CI fixture"
git push -u origin "$branch"

cat <<EOF

Self-dogfood branch pushed: $branch

Next steps:
1. Open a pull request from $branch.
2. Let CI fail on src/self-dogfood-failure.test.ts.
3. Trigger DevLoop GitHub App with a PR comment:
   /devloop dry-run
   /devloop fix
4. Or run the GitHub Action template against the failed workflow.

The expected DevLoop fix is to remove or correct the temporary failing assertion.
EOF
