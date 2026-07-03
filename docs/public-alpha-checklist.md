# Public Alpha Checklist

Use this checklist before switching the repository from private to public and publishing `v0.1.0-alpha.0`.

## Repository

- [ ] Repo is public.
- [x] CI green.
- [x] Security workflow green.
- [x] Remote secret scan passed.
- [x] Local gitleaks scan passed.
- [ ] Branch protection enabled.
- [ ] Push protection enabled.
- [ ] README ready.
- [x] Demo works.
- [x] Self-fix PR linked.
- [ ] Release tag exists.
- [ ] GitHub release published.
- [x] npm publish configured or intentionally deferred.
- [x] Social launch copy ready.

## Current Audit Notes

- Repository is still private by design.
- Latest observed remote `CI` and `Security` workflows on `main` were green during the July 3, 2026 audit.
- Remote `Security` includes gitleaks and dependency audit.
- Local gitleaks `8.30.1` passed on July 3, 2026 with `gitleaks detect --source . --redact --verbose`.
- `.gitleaksignore` contains two exact historical fingerprints for false positives in `scripts/self-dogfood/local.sh`, where the script unsets provider tokens before running local self-dogfood tests.
- No Dependabot pull requests were open during the July 3, 2026 audit; latest Dependabot update workflows on `main` were green.
- Branch protection and push protection are not enabled because the current private repository/account settings do not expose them through the available GitHub API path.
- README and `docs/self-dogfooding.md` link the real DevLoop-generated self-fix PR: `https://github.com/maxi-maxima/devloop-ai/pull/7`.
- `./scripts/demo-autofix.sh` passed in the latest local audit when run with Git Bash on Windows.
- `v0.1.0-alpha.0` tag and GitHub prerelease are not present yet.
- npm publish is intentionally deferred.
- Launch copy exists, but should not be posted until the release tag and GitHub prerelease exist.

## Suggested Release Sequence

1. Merge release prep into `main`.
2. Verify `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
3. Run `./scripts/demo-autofix.sh`.
4. Run `./scripts/self-dogfood/local.sh`.
5. Create or link the real self-fix PR.
6. Re-run local gitleaks and confirm remote `Security` is green before making the repository public.
7. Enable branch protection and push protection.
8. Create tag `v0.1.0-alpha.0`.
9. Publish the GitHub release using `docs/releases/v0.1.0-alpha.0.md`.
10. Decide whether npm publish is ready or intentionally deferred.
11. Publish launch copy.

## Notes

- Keep `.gitleaksignore` entries narrow and fingerprint-based; do not path-ignore files.
- Do not mark future secret scanning complete based only on local skip output; use CI or a local gitleaks run.
- Keep auto-merge disabled for alpha.
