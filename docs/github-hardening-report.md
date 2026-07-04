# GitHub Hardening Report

Generated for the immediate post-public repository hardening audit.

## Repository

- Repository: `maxi-maxima/devloop-ai`
- URL: `https://github.com/maxi-maxima/devloop-ai`
- Visibility: public
- Default branch: `main`
- Latest inspected commit before this report update: `a223c73d8216832ad00f5194fc10387883606e13`

## Latest Remote CI Status

Latest relevant runs on `main` at the July 4, 2026 post-public inspection time:

| Workflow | Run ID | Status |
|---|---:|---|
| CI | `28702418499` | success |
| Security | `28702418515` | success |

Discovered check/job names from the inspected commit:

- `Build, lint, typecheck, and test`: success
- `Secret scan`: success
- `Dependency audit`: success
- `CodeQL`: success

Recommended globally required checks for `main`:

- `Build, lint, typecheck, and test`
- `Secret scan`
- `Dependency audit`
- `CodeQL`

Do not make `Self Dogfood Fixture` globally required because that workflow is path-limited and will not run on every pull request.

## Actions Permissions

Status: configured through GitHub API.

- Default workflow token permission: `read`
- Workflow PR approval by GitHub Actions: disabled

Command used:

```bash
gh api -X PUT repos/maxi-maxima/devloop-ai/actions/permissions/workflow \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
```

Only workflows that need write access should declare it explicitly. Current release-relevant workflows follow this posture:

- `.github/workflows/ci.yml`: `contents: read`
- `.github/workflows/security.yml`: `contents: read`, with `security-events: write` only inside the CodeQL job
- `.github/workflows/self-dogfood-devloop.yml`: explicit `contents: write` and `pull-requests: write` because it creates the dogfood PR

## Branch Protection / Rulesets

Status: enabled through GitHub API.

Configured policy target for `main`:

- Require a pull request before merging.
- Require 1 approving review.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution.
- Required checks:
  - `Build, lint, typecheck, and test`
  - `Secret scan`
  - `Dependency audit`
  - `CodeQL`
- Block force pushes.
- Block branch deletion.
- Administrator enforcement is disabled for this alpha to avoid accidental owner lockout.
- Repository rulesets are not used; the branch protection rule is the active protection mechanism.

Temporary launch-blocker exception:

- Required approving reviews were temporarily relaxed from 1 to 0 on July 4, 2026 to merge PR `#8`, the launch-blocking CodeQL `js/polynomial-redos` fix.
- Required CI/Security checks remained enabled: `Build, lint, typecheck, and test`, `Secret scan`, `Dependency audit`, and `CodeQL`.
- Branch up-to-date checks, conversation resolution, force-push blocking, and deletion blocking remained enabled.
- CodeQL and Security workflows were not disabled.
- The 1 approving review requirement was restored after the controlled PR `#8` merge.

## Secret Scanning And Push Protection

Status: enabled through GitHub API.

The repository security API returned:

```text
secret_scanning: enabled
secret_scanning_push_protection: enabled
```

Current compensating controls:

- `.github/workflows/security.yml` runs gitleaks on pushes and pull requests.
- Latest `Security` workflow completed successfully.
- Local gitleaks `8.30.1` completed successfully during the July 4, 2026 post-public audit.
- Release prechecks also run local or fallback secret scans before tagging.

No open secret scanning alerts were observed after enabling secret scanning.

## Dependabot

Status: enabled/configured.

- Dependabot alerts: enabled through GitHub API.
- Dependabot security updates: enabled through GitHub API.
- `.github/dependabot.yml` configures weekly update checks for npm and GitHub Actions.
- `.github/workflows/security.yml` also runs `npm audit --audit-level=high`.

Commands verified:

```bash
gh api -X PUT repos/maxi-maxima/devloop-ai/vulnerability-alerts
gh api -X PUT repos/maxi-maxima/devloop-ai/automated-security-fixes
gh api repos/maxi-maxima/devloop-ai/automated-security-fixes
```

Manual follow-up:

1. Go to `Settings -> Code security and analysis`.
2. Confirm Dependabot alerts are enabled.
3. Confirm Dependabot security updates are enabled.

## CodeQL / Code Scanning

Status: workflow present and CodeQL ran successfully. PR `#8` has been squash-merged into `main`, and the code scanning API reported zero open CodeQL alerts after the July 4, 2026 post-merge Security run.

Before PR `#8`, the code scanning alerts API returned 8 open high-severity alerts:

| Alert | Rule | Severity | File | Line |
|---:|---|---|---|---:|
| 1 | `js/polynomial-redos` | high | `src/core/guardrails.ts` | 49 |
| 2 | `js/polynomial-redos` | high | `src/core/patcher.ts` | 21 |
| 3 | `js/polynomial-redos` | high | `src/core/patcher.ts` | 27 |
| 4 | `js/polynomial-redos` | high | `src/firewall/patch-risk-detector.ts` | 86 |
| 5 | `js/polynomial-redos` | high | `src/org/config.ts` | 27 |
| 6 | `js/polynomial-redos` | high | `src/org/config.ts` | 31 |
| 7 | `js/polynomial-redos` | high | `src/org/config.ts` | 45 |
| 8 | `js/polynomial-redos` | high | `src/org/config.ts` | 57 |

Current workflow behavior:

- `.github/workflows/security.yml` includes a CodeQL job for JavaScript/TypeScript.
- The CodeQL job is configured to run automatically when the repository is public.
- The latest inspected `Security` run completed `CodeQL` successfully.
- While the repository is private, the job only runs when repository variable `ENABLE_CODEQL_ON_PRIVATE=true` is set.
- This avoids surprising GitHub Advanced Security requirements while the repository remains private.
- PR `#8` (`fix: eliminate CodeQL ReDoS risks`) was squash-merged as `ced388f195ecad0b834ddf7a93d08c46a7b679fe` after local validation and all PR CI/Security checks passed.

Manual steps when supported:

1. Go to `Settings -> Code security and analysis`.
2. Enable CodeQL/default setup if available.
3. For private-repo CodeQL, confirm GitHub Advanced Security is available first.
4. Set repository variable `ENABLE_CODEQL_ON_PRIVATE=true` only after private CodeQL support is confirmed.
5. Run the `Security` workflow and confirm `CodeQL` completes successfully before making it a required check.

## Required Security And Launch Files

Tracked files present:

- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `README.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `docs/security-model.md`
- `docs/self-hosting.md`
- `docs/github-app.md`
- `docs/mcp.md`
- `docs/evidence-bundles.md`
- `docs/agent-firewall.md`
- `docs/public-alpha-checklist.md`
- `docs/launch-copy.md`
- `docs/releases/v0.1.0-alpha.0.md`
- `docs/releases/v0.1.0-alpha.1.md`

## Manual Steps Still Required

- Prepare and publish `v0.1.0-alpha.2` before launch posts.
- Do not move or recreate the public `v0.1.0-alpha.1` tag or release.
- Re-run CI and Security after any manual settings change.
- Do not publish npm or launch posts until the immediate post-public protection audit is green.
