# Contributing

Thanks for helping make DevLoop safer and more useful.

## Good First Contributions

- add a small FixBench case,
- improve documentation,
- add a safe Security Autofix fixture,
- tighten patch guardrails,
- improve CLI output,
- test GitHub App setup paths.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Contribution Rules

- Keep patches small.
- Prefer tests for behavior changes.
- Do not add secrets or private logs.
- Do not disable tests, linting, type checks, or security checks to make CI pass.
- Keep AI-generated changes human-reviewable.
- Update docs when CLI commands, safety rules, or public workflows change.

## Adding FixBench Cases

Fixtures should be small, deterministic, and safe:

- no network dependency unless explicitly marked,
- one clear bug,
- one validation command,
- expected changed files documented,
- no exploit payloads or real credentials.

## Pull Requests

Use the PR template and include:

- summary,
- validation commands,
- files changed,
- risk level,
- docs updates if needed.
