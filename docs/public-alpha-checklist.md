# Public Alpha Checklist

Use this checklist before switching the repository from private to public and publishing launch posts for `v0.1.0-alpha.0`.

## Repository

- [ ] Repo is public.
- [x] CI green.
- [x] Security workflow green.
- [x] Remote secret scan passed.
- [x] Local gitleaks scan passed.
- [ ] Branch protection enabled.
- [ ] Push protection enabled.
- [x] Post-public protection steps documented.
- [x] README ready.
- [x] Demo works.
- [x] Self-fix PR linked.
- [x] Release tag exists.
- [x] GitHub prerelease published.
- [x] npm publish configured or intentionally deferred.
- [x] Social launch copy ready.

## Current Audit Notes

- Repository is still private by design.
- Latest observed remote `CI` and `Security` workflows on `main` were green during the July 3, 2026 final audit.
- Remote `Security` includes gitleaks and dependency audit.
- Local gitleaks `8.30.1` passed on July 3, 2026 with `gitleaks detect --source . --redact --verbose`.
- `.gitleaksignore` contains two exact historical fingerprints for false positives in `scripts/self-dogfood/local.sh`, where the script unsets provider tokens before running local self-dogfood tests.
- No Dependabot pull requests were open during the July 3, 2026 audit; latest Dependabot update workflows on `main` were green.
- Branch protection and repository rulesets are not enabled because the current private repository/account settings return `Upgrade to GitHub Pro or make this repository public to enable this feature`.
- Secret scanning and push protection are not enabled through GitHub settings while private; local gitleaks and the remote `Security` workflow are the current compensating controls.
- Branch protection, required checks, secret scanning, push protection, and Actions read-only confirmation must be performed immediately after switching visibility to public.
- README and `docs/self-dogfooding.md` link the real DevLoop-generated self-fix PR: `https://github.com/maxi-maxima/devloop-ai/pull/7`.
- `./scripts/demo-autofix.sh` passed in the latest local audit when run with Git Bash on Windows.
- `v0.1.0-alpha.0` annotated tag and GitHub prerelease are present.
- npm publish is intentionally deferred.
- Launch copy exists, but should not be posted until the repository is public and the immediate post-public protection audit is green.

## Suggested Public Visibility Sequence

1. Change repository visibility from private to public in GitHub settings.
2. Immediately enable main branch protection or a branch ruleset.
3. Require pull request review if available.
4. Require the latest successful `CI` and `Security` checks.
5. Disable force pushes and branch deletion.
6. Confirm secret scanning is active.
7. Enable push protection if available.
8. Confirm Actions default workflow permissions remain read-only.
9. Rerun the final launch readiness audit.
10. Confirm README renders correctly.
11. Only then publish launch copy.

## Notes

- Keep `.gitleaksignore` entries narrow and fingerprint-based; do not path-ignore files.
- Do not mark future secret scanning complete based only on local skip output; use CI or a local gitleaks run.
- Keep auto-merge disabled for alpha.
- Do not publish npm for this alpha unless explicitly decided later.
