# Public Alpha Checklist

Use this checklist for the immediate post-public protection gate before publishing launch posts for `v0.1.0-alpha.2`.

## Repository

- [x] Repo is public.
- [x] CI green.
- [x] Security workflow green.
- [x] Remote secret scan passed.
- [x] Local gitleaks scan passed.
- [ ] CodeQL/code scanning alerts triaged or resolved.
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
- Latest observed remote `CI` and `Security` workflows on `main` were green during the July 4, 2026 launch-post readiness audit.
- Remote `Security` includes gitleaks, dependency audit, and CodeQL.
- CodeQL completed successfully in the post-public `Security` run, but main still has 8 open high-severity `js/polynomial-redos` alerts.
- Local gitleaks `8.30.1` passed on July 4, 2026 with `gitleaks detect --source . --redact --verbose`.
- `.gitleaksignore` contains two exact historical fingerprints for false positives in `scripts/self-dogfood/local.sh`, where the script unsets provider tokens before running local self-dogfood tests.
- No Dependabot pull requests were open during the July 4, 2026 post-public audit.
- Open pull requests observed during the July 4, 2026 launch-post readiness audit were the real self-fix PR `#7` and CodeQL ReDoS fix PR `#8`.
- PR `#8` has passing checks and zero `js/polynomial-redos` alerts on its branch, but it has not been merged into `main`.
- Branch protection is enabled for `main` with required PR review, 1 approval, up-to-date required checks, required conversation resolution, blocked force pushes, and blocked deletion.
- Required checks are `Build, lint, typecheck, and test`, `Secret scan`, `Dependency audit`, and `CodeQL`.
- Repository rulesets are not used; the branch protection rule is the active protection mechanism.
- GitHub secret scanning is enabled according to `gh api repos/maxi-maxima/devloop-ai --jq '.security_and_analysis'`.
- GitHub push protection is enabled according to the same repository security API response.
- Actions default workflow token permissions are read-only.
- README and `docs/self-dogfooding.md` link the real DevLoop-generated self-fix PR: `https://github.com/maxi-maxima/devloop-ai/pull/7`.
- `./scripts/demo-autofix.sh` passed in the latest local audit when run with Git Bash on Windows.
- `v0.1.0-alpha.0` annotated tag and GitHub prerelease are present, but the tag points to an earlier launch-readiness commit.
- `v0.1.0-alpha.1` is the intended public alpha release because it includes the final README, checklist, and hardening documentation corrections.
- `v0.1.0-alpha.2` is not yet tagged or released; README still points to `v0.1.0-alpha.1`.
- npm publish is intentionally deferred.
- Launch copy exists, but should not be posted until PR `#8` is merged, `main` has zero high-severity CodeQL alerts, and `v0.1.0-alpha.2` exists.

## Required Post-Public Remediation

1. Merge PR `#8` to resolve the 8 open high-severity CodeQL `js/polynomial-redos` alerts on `main`.
2. Wait for `main` CI and Security to complete successfully.
3. Confirm zero open high-severity CodeQL alerts.
4. Prepare and publish `v0.1.0-alpha.2`.
5. Rerun the final launch readiness audit.
6. Confirm README and release pages render correctly.
7. Only then publish launch copy.

## Notes

- Keep `.gitleaksignore` entries narrow and fingerprint-based; do not path-ignore files.
- Do not mark future secret scanning complete based only on local skip output; use CI or a local gitleaks run.
- Keep auto-merge disabled for alpha.
- Do not publish npm for this alpha unless explicitly decided later.
