# GitHub Hardening Report

Generated for the private pre-public-launch repository hardening pass.

## Repository

- Repository: `maxi-maxima/devloop-ai`
- URL: `https://github.com/maxi-maxima/devloop-ai`
- Visibility: private
- Default branch: `main`
- Latest checked commit: `45977ea7bbe5fa549da65e749fbf11a19ffc6993`

## Latest Remote CI Status

Latest runs on `main` for commit `45977ea7bbe5fa549da65e749fbf11a19ffc6993`:

| Workflow | Run ID | Status |
|---|---:|---|
| CI | `28657674621` | success |
| Security | `28657674623` | success |
| Self Dogfood Fixture | `28657674641` | success |

Discovered status check/job names:

- `Build, lint, typecheck, and test`
- `Secret scan`
- `Dependency audit`
- `Run self-dogfood fixture`

## Actions Permissions

- Default workflow token permission: `read`
- Workflow PR approval by GitHub Actions: disabled
- Status: configured through GitHub API.

Workflows that need write access should continue to declare explicit job-level or workflow-level permissions.

## Branch Protection / Rulesets

Status: not enabled through API.

GitHub returned `403` for both branch protection and repository rulesets on this private repository:

```text
Upgrade to GitHub Pro or make this repository public to enable this feature.
```

Recommended policy for `main` once available:

- Require pull request before merging.
- Require at least 1 approving review.
- Require status checks to pass.
- Require branches to be up to date before merging if feasible.
- Require conversation resolution if available.
- Block force pushes.
- Block branch deletion.
- Suggested required checks:
  - `Build, lint, typecheck, and test`
  - `Secret scan`
  - `Dependency audit`
  - `Run self-dogfood fixture`

Manual steps:

1. Go to `Settings -> Branches` or `Settings -> Rules -> Rulesets`.
2. Add a rule targeting `main`.
3. Enable the policy above.
4. Avoid enabling settings that would lock out the repository owner.

## Secret Scanning And Push Protection

Status: not available through API for the current private repository.

GitHub returned:

```text
Secret scanning is not available for this repository.
```

Current compensating controls:

- `.github/workflows/security.yml` runs gitleaks on pushes and pull requests.
- Latest `Security` workflow completed successfully.
- Release gate fallback scan did not find real secrets.

Manual steps when supported:

1. Go to `Settings -> Code security and analysis`.
2. Enable `Secret scanning`.
3. Enable `Push protection`.
4. Keep the gitleaks workflow enabled as a second layer.

## Dependabot

- Dependabot alerts: enabled through GitHub API.
- Dependabot security updates: enabled through GitHub API.
- Latest `Security` workflow also runs `npm audit --audit-level=high`.

Manual follow-up:

1. Go to `Settings -> Code security and analysis`.
2. Confirm Dependabot alerts are enabled.
3. Confirm Dependabot security updates are enabled.

## CodeQL / Code Scanning

Status: default setup not enabled through API.

GitHub returned:

```text
Code scanning is not enabled for this repository. Please enable code scanning in the repository settings.
```

Current workflow behavior:

- `.github/workflows/security.yml` includes a CodeQL job.
- The CodeQL job is skipped for private repositories unless repository variable `ENABLE_CODEQL_ON_PRIVATE=true` is set.
- This avoids surprising GitHub Advanced Security requirements while the repository remains private.

Manual steps when supported:

1. Go to `Settings -> Code security and analysis`.
2. Enable CodeQL/default setup if available.
3. Alternatively set repository variable `ENABLE_CODEQL_ON_PRIVATE=true` only when GitHub Advanced Security is available for the private repository.

## Required Security And Launch Files

All required files were present and tracked:

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

## Manual Steps Still Required

- Keep the repository private until the public launch decision is explicit.
- Enable branch protection or a ruleset for `main` after upgrading to GitHub Pro or after making the repository public.
- Enable Secret scanning and Push protection when GitHub makes them available for this repository.
- Enable CodeQL/default setup or `ENABLE_CODEQL_ON_PRIVATE=true` only when private CodeQL is supported for this account.
- Re-run CI after any manual settings change.
- Do not create a GitHub release or publish to npm until the public launch checklist is complete.
