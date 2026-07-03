# Public Alpha Checklist

Use this checklist before switching the repository from private to public and publishing `v0.1.0-alpha.0`.

## Repository

- [ ] Repo is public.
- [ ] CI green.
- [ ] Secret scan passed.
- [ ] Branch protection enabled.
- [ ] Push protection enabled.
- [ ] README ready.
- [ ] Demo works.
- [ ] Self-fix PR linked.
- [ ] Release tag exists.
- [ ] GitHub release published.
- [ ] npm publish configured or intentionally deferred.
- [ ] Social launch copy ready.

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
