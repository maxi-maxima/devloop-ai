# GitHub Hardening Report

Generated for the immediate post-public repository hardening audit.

## Repository

- Repository: `maxi-maxima/devloop-ai`
- URL: `https://github.com/maxi-maxima/devloop-ai`
- Visibility: public
- Default branch: `main`
- Latest inspected commit before this report update: `4296fe96a92fcf4a44850916e75996b2deea9fb1`

## Latest Remote CI Status

Latest relevant runs on `main` at the July 4, 2026 post-public inspection time:

| Workflow | Run ID | Status |
|---|---:|---|
| CI | `28672868944` | success |
| Security | `28672868952` | success |

Discovered check/job names from the inspected commit:

- `Build, lint, typecheck, and test`: success
- `Secret scan`: success
- `Dependency audit`: success
- `CodeQL`: skipped while private unless repository variable `ENABLE_CODEQL_ON_PRIVATE=true` is set

Recommended globally required checks for `main`:

- `Build, lint, typecheck, and test`
- `Secret scan`
- `Dependency audit`

Do not make `Self Dogfood Fixture` globally required because that workflow is path-limited and will not run on every pull request. Add `CodeQL` as a required check only after code scanning is enabled and a successful CodeQL run has been observed.

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

Status: not enabled.

The branch protection API returned:

```text
Branch not protected
```

The repository rulesets API returned an empty list. No branch protection or ruleset is currently active for `main`.

Recommended policy for `main` once available:

- Require pull request before merging.
- Require at least 1 approving review.
- Require status checks to pass before merging.
- Require branches to be up to date before merging if feasible.
- Require conversation resolution if available.
- Block force pushes.
- Block branch deletion.
- Do not initially enable admin enforcement until the owner confirms the policy does not block emergency maintenance.

Manual branch protection steps:

1. Go to `Settings -> Branches`.
2. Select `Add branch protection rule`.
3. Set branch name pattern to `main`.
4. Enable `Require a pull request before merging`.
5. Enable at least 1 required approval if available.
6. Enable `Require status checks to pass before merging`.
7. Select:
   - `Build, lint, typecheck, and test`
   - `Secret scan`
   - `Dependency audit`
8. Enable `Require conversation resolution before merging` if available.
9. Ensure force pushes are not allowed.
10. Ensure deletions are not allowed.
11. Leave administrator enforcement off for the first pass unless the owner wants stricter governance.

Manual ruleset alternative:

1. Go to `Settings -> Rules -> Rulesets`.
2. Select `New branch ruleset`.
3. Target branch pattern `main`.
4. Enable pull request, review, status check, conversation resolution, no force push, and no deletion rules.
5. Add the same required checks listed above.
6. Include an owner/admin bypass during private alpha to avoid accidental lockout.

## Secret Scanning And Push Protection

Status: disabled.

The API returned:

```text
Secret scanning is disabled on this repository.
```

Current compensating controls:

- `.github/workflows/security.yml` runs gitleaks on pushes and pull requests.
- Latest `Security` workflow completed successfully.
- Local gitleaks `8.30.1` completed successfully during the July 4, 2026 post-public audit.
- Release prechecks also run local or fallback secret scans before tagging.

Manual steps:

1. Go to `Settings -> Code security and analysis`.
2. Find `Secret scanning`.
3. Select `Enable`.
4. Find `Push protection`.
5. Select `Enable`.
6. Keep the gitleaks workflow enabled as a second layer.

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

Status: workflow present and CodeQL ran successfully, but open alerts require triage.

The code scanning alerts API returned 8 open high-severity alerts:

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

- Triage or resolve the 8 open high-severity CodeQL `js/polynomial-redos` alerts.
- Enable branch protection or a ruleset for `main`.
- Enable GitHub Secret scanning.
- Enable Push protection if available.
- Run the Security workflow after CodeQL fixes or triage decisions are complete.
- Re-run CI and Security after any manual settings change.
- Do not publish npm or launch posts until the immediate post-public protection audit is green.
