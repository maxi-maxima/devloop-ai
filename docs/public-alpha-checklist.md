# Public Alpha Checklist

Use this checklist for the immediate post-public protection gate before publishing launch posts for `v0.1.0-alpha.1`.

## Repository

- [x] Repo is public.
- [x] CI green.
- [x] Security workflow green.
- [x] Remote secret scan passed.
- [x] Local gitleaks scan passed.
- [ ] GitHub secret scanning enabled.
- [ ] Branch protection enabled.
- [ ] Push protection enabled.
- [x] Actions default workflow token is read-only.
- [x] Post-public protection steps documented.
- [x] README ready.
- [x] Demo works.
- [x] Self-fix PR linked.
- [x] Release tag exists.
- [x] GitHub prerelease published.
- [x] npm publish configured or intentionally deferred.
- [x] Social launch copy ready.

## Current Audit Notes

- Repository is public as of the July 4, 2026 post-public audit.
- Latest observed remote `CI` and `Security` workflows on `main` were green during the July 4, 2026 post-public audit.
- Remote `Security` includes gitleaks and dependency audit.
- Local gitleaks `8.30.1` passed on July 4, 2026 with `gitleaks detect --source . --redact --verbose`.
- `.gitleaksignore` contains two exact historical fingerprints for false positives in `scripts/self-dogfood/local.sh`, where the script unsets provider tokens before running local self-dogfood tests.
- No Dependabot pull requests were open during the July 4, 2026 post-public audit.
- The only open pull request observed during the July 4, 2026 audit was the real self-fix PR `#7`.
- Branch protection is not enabled: `gh api repos/maxi-maxima/devloop-ai/branches/main/protection` returns `Branch not protected`.
- Repository rulesets are not enabled: `gh api repos/maxi-maxima/devloop-ai/rulesets` returns `[]`.
- GitHub secret scanning is disabled according to `gh api repos/maxi-maxima/devloop-ai --jq '.security_and_analysis'`.
- GitHub push protection is disabled according to the same repository security API response.
- Actions default workflow token permissions are read-only.
- README and `docs/self-dogfooding.md` link the real DevLoop-generated self-fix PR: `https://github.com/maxi-maxima/devloop-ai/pull/7`.
- `./scripts/demo-autofix.sh` passed in the latest local audit when run with Git Bash on Windows.
- `v0.1.0-alpha.0` annotated tag and GitHub prerelease are present, but the tag points to an earlier launch-readiness commit.
- `v0.1.0-alpha.1` is the intended public alpha release because it includes the final README, checklist, and hardening documentation corrections.
- npm publish is intentionally deferred.
- Launch copy exists, but should not be posted until branch protection, GitHub secret scanning, and push protection are enabled.

## Required Post-Public Remediation

1. Enable main branch protection or a branch ruleset.
2. Require pull request review if available.
3. Require the latest successful `CI` and `Security` checks.
4. Disable force pushes and branch deletion.
5. Enable GitHub secret scanning.
6. Enable push protection if available.
7. Rerun the final launch readiness audit.
8. Confirm README and release pages render correctly.
9. Only then publish launch copy.

## Notes

- Keep `.gitleaksignore` entries narrow and fingerprint-based; do not path-ignore files.
- Do not mark future secret scanning complete based only on local skip output; use CI or a local gitleaks run.
- Keep auto-merge disabled for alpha.
- Do not publish npm for this alpha unless explicitly decided later.
