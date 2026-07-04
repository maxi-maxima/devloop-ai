# Public Alpha Checklist

Use this checklist for the immediate post-public protection gate before publishing launch posts for `v0.1.0-alpha.2`.

## Repository

- [x] Repo is public.
- [x] CI green.
- [x] Security workflow green.
- [x] Remote secret scan passed.
- [x] Local gitleaks scan passed.
- [x] CodeQL/code scanning alerts triaged or resolved.
- [x] GitHub secret scanning enabled.
- [x] Branch protection enabled.
- [x] Push protection enabled.
- [x] Actions default workflow token is read-only.
- [x] Post-public protection steps documented.
- [x] README ready.
- [x] Demo works.
- [x] Self-fix PR linked.
- [ ] `v0.1.0-alpha.2` release tag exists.
- [ ] `v0.1.0-alpha.2` GitHub prerelease published.
- [x] npm publish configured or intentionally deferred.
- [x] Social launch copy ready.

## Current Audit Notes

- Repository is public as of the July 4, 2026 post-public audit.
- Latest observed remote `CI` and `Security` workflows on `main` were green during the July 4, 2026 post-PR-8 verification.
- Remote `Security` includes gitleaks, dependency audit, and CodeQL.
- CodeQL completed successfully after PR `#8` was squash-merged into `main`; the code scanning API reported zero open CodeQL alerts after the July 4, 2026 post-merge Security run.
- Local gitleaks `8.30.1` passed on July 4, 2026 with `gitleaks detect --source . --redact --verbose`.
- `.gitleaksignore` contains two exact historical fingerprints for false positives in `scripts/self-dogfood/local.sh`, where the script unsets provider tokens before running local self-dogfood tests.
- No Dependabot pull requests were open during the July 4, 2026 post-public audit.
- Open pull requests observed during the July 4, 2026 launch-post readiness audit were the real self-fix PR `#7` and CodeQL ReDoS fix PR `#8`; PR `#8` is now merged.
- PR `#8` was squash-merged on July 4, 2026 as `ced388f195ecad0b834ddf7a93d08c46a7b679fe` after all local validation and PR CI/Security checks passed.
- Required approving reviews were temporarily relaxed from 1 to 0 to merge the launch-blocking CodeQL ReDoS fix, then restored to 1 after PR `#8` merged. Required CI/Security checks remained enabled; CodeQL and Security workflows were not disabled.
- Branch protection remains enabled for `main` with 1 required approving review, up-to-date required checks, required conversation resolution, blocked force pushes, and blocked deletion.
- Required checks are `Build, lint, typecheck, and test`, `Secret scan`, `Dependency audit`, and `CodeQL`.
- Repository rulesets are not used; the branch protection rule is the active protection mechanism.
- GitHub secret scanning is enabled according to `gh api repos/maxi-maxima/devloop-ai --jq '.security_and_analysis'`.
- GitHub push protection is enabled according to the same repository security API response.
- Actions default workflow token permissions are read-only.
- README and `docs/self-dogfooding.md` link the real DevLoop-generated self-fix PR: `https://github.com/maxi-maxima/devloop-ai/pull/7`.
- `./scripts/demo-autofix.sh` passed in the latest local audit when run with Git Bash on Windows.
- `v0.1.0-alpha.0` annotated tag and GitHub prerelease are present, but the tag points to an earlier launch-readiness commit.
- `v0.1.0-alpha.1` is the current published prerelease and must not be moved now that the repository is public.
- `v0.1.0-alpha.2` is the next launch candidate for the CodeQL ReDoS fixes plus post-public hardening documentation.
- `v0.1.0-alpha.2` is not yet tagged or released; README still points to the current published `v0.1.0-alpha.1` prerelease.
- npm publish is intentionally deferred.
- Launch copy exists, but should not be posted until `v0.1.0-alpha.2` exists and the final launch-post audit is green.

## Required Post-Public Remediation

1. Prepare and publish `v0.1.0-alpha.2`; do not move or recreate `v0.1.0-alpha.1`.
2. Rerun the final launch readiness audit.
3. Confirm README and release pages render correctly.
4. Only then publish launch copy.

## Notes

- Keep `.gitleaksignore` entries narrow and fingerprint-based; do not path-ignore files.
- Do not mark future secret scanning complete based only on local skip output; use CI or a local gitleaks run.
- Keep auto-merge disabled for alpha.
- Do not publish npm for this alpha unless explicitly decided later.
