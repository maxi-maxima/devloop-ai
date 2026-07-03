#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="${DEVLOOP_SELF_DOGFOOD_BRANCH:-dogfood/failing-ci}"
BASE_BRANCH="${DEVLOOP_SELF_DOGFOOD_BASE:-main}"
FORCE=0
DELETE_REMOTE=0

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=1
      ;;
    --delete-remote)
      DELETE_REMOTE=1
      ;;
    *)
      echo "usage: $0 [--force] [--delete-remote]" >&2
      exit 1
      ;;
  esac
done

fail() {
  echo "self-dogfood reset failed: $*" >&2
  exit 1
}

cd "$ROOT"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "run this inside the DevLoop git repository"

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "$FORCE" != "1" ]]; then
    fail "working tree is dirty; rerun with --force to restore self-dogfood fixture changes"
  fi
  git restore --worktree --staged fixtures/self-dogfood/src/user.js 2>/dev/null || true
fi

git switch main

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch -D "$BRANCH"
else
  echo "Local branch $BRANCH does not exist."
fi

if [[ "$DELETE_REMOTE" == "1" ]]; then
  git push origin --delete "$BRANCH" || true
else
  echo "Remote branch, if present, was left untouched. Use --delete-remote to remove it."
fi

echo "Self-dogfood reset complete on $BASE_BRANCH."
