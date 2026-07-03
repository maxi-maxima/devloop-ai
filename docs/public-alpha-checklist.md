# Public Alpha Checklist

Use this checklist before switching the repository from private to public and publishing `v0.1.0-alpha.0`.

## Repository

- [ ] Repo is public.
- [x] CI green.
- [x] Security workflow green.
- [x] Remote secret scan passed.
- [ ] Branch protection enabled.
- [ ] Push protection enabled.
- [ ] README ready.
- [x] Demo works.
- [ ] Self-fix PR linked.
- [ ] Release tag exists.
- [ ] GitHub release published.
- [x] npm publish configured or intentionally deferred.
- [x] Social launch copy ready.

## Current Audit Notes

- Repository is still private by design.
- Latest remote `CI` and `Security` workflows on `main` are green as of commit `97a7f650b490f32801519fef74544fc0e8dbfed4`.
- Remote `Security` includes gitleaks and dependency audit; local gitleaks was unavailable during the latest audit, so install it before changing repository visibility.
- Newly opened Dependabot pull requests currently have failing `Security` checks and should be triaged or closed before launch to avoid a noisy public first impression.
- Branch protection and push protection are not enabled because the current private repository/account settings do not expose them through the available GitHub API path.
- README is not launch-ready until the self-fix PR placeholder is replaced with a real DevLoop-generated PR URL.
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
6. Run a secret scan before making the repository public.
7. Enable branch protection and push protection.
8. Create tag `v0.1.0-alpha.0`.
9. Publish the GitHub release using `docs/releases/v0.1.0-alpha.0.md`.
10. Decide whether npm publish is ready or intentionally deferred.
11. Publish launch copy.

## Notes

- Do not mark the self-fix PR checkbox until the README placeholder has been replaced with a real PR URL.
- Do not mark secret scanning complete based only on local skip output; use CI or a local gitleaks run.
- Keep auto-merge disabled for alpha.
