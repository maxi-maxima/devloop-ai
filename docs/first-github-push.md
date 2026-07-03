# First GitHub Push

Use this checklist to push DevLoop AI safely for the first time, keep it private while release gates run, and make it public only after the alpha checks pass.

Replace `OWNER` with your GitHub user or organization.

## 1. Initialize Git

```bash
cd E:/Projects/devloop-ai
git init
git add .
git update-index --chmod=+x scripts/*.sh scripts/*.mjs .agents/skills/devloop-autofix/scripts/*.sh
git commit -m "chore: initial DevLoop AI alpha"
git branch -M main
```

If the repository already has git history, skip `git init` and confirm the current branch:

```bash
git status
git branch --show-current
```

## 2. Create A Private GitHub Repository

With GitHub CLI:

```bash
gh auth login
gh repo create OWNER/devloop-ai --private --source=. --remote=origin --push
```

Manual alternative:

1. Open `https://github.com/new`.
2. Create `OWNER/devloop-ai` as a private repository.
3. Do not initialize it with a README, license, or `.gitignore`.
4. Push:

```bash
git remote add origin https://github.com/OWNER/devloop-ai.git
git push -u origin main
```

## 3. Enable Branch Protection

Create a basic protection payload:

```bash
cat > /tmp/devloop-branch-protection.json <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Build, lint, typecheck, and test"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

gh api \
  --method PUT \
  repos/OWNER/devloop-ai/branches/main/protection \
  --input /tmp/devloop-branch-protection.json
```

Manual alternative:

1. Go to `Settings -> Rules -> Rulesets`.
2. Add a branch ruleset for `main`.
3. Require pull requests.
4. Require the CI status check.
5. Block force pushes and branch deletion.

## 4. Enable Secret Scanning And Push Protection

GitHub CLI:

```bash
cat > /tmp/devloop-security-analysis.json <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "enabled"
    }
  }
}
JSON

gh api \
  --method PATCH \
  repos/OWNER/devloop-ai \
  --input /tmp/devloop-security-analysis.json
```

Manual alternative:

1. Go to `Settings -> Code security and analysis`.
2. Enable secret scanning.
3. Enable push protection.
4. Keep Dependabot alerts enabled.

## 5. Configure Actions Permissions

GitHub CLI:

```bash
cat > /tmp/devloop-actions-permissions.json <<'JSON'
{
  "enabled": true,
  "allowed_actions": "selected",
  "github_owned_allowed": true,
  "verified_allowed": true,
  "patterns_allowed": [
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "actions/upload-artifact@v4",
    "github/codeql-action/*@v3",
    "gitleaks/gitleaks-action@v2"
  ]
}
JSON

gh api \
  --method PUT \
  repos/OWNER/devloop-ai/actions/permissions \
  --input /tmp/devloop-actions-permissions.json
```

Manual alternative:

1. Go to `Settings -> Actions -> General`.
2. Allow GitHub-owned actions and verified creators.
3. Set workflow permissions to read repository contents by default.
4. Keep "Allow GitHub Actions to create and approve pull requests" disabled unless a specific workflow needs it.

## 6. Run Release Gates Locally

```bash
npm ci
bash scripts/verify-public-release-ready.sh
npm run security:secrets
```

On Windows, use Git Bash if `bash` points to an unavailable WSL install:

```powershell
& "C:\Program Files\Git\bin\bash.exe" scripts/verify-public-release-ready.sh
```

If `gitleaks` is not installed, install it and rerun the secret scan:

```bash
winget install Gitleaks.Gitleaks
npm run security:secrets
```

## 7. Install DevLoop GitHub App On DevLoop

Manual setup is safest for the first private push:

1. Create or open the DevLoop GitHub App.
2. Set the webhook URL to your self-hosted DevLoop endpoint, for example `https://your-host.example.com/webhooks/github`.
3. Subscribe to workflow, check, issue comment, and pull request review comment events.
4. Install the app on `OWNER/devloop-ai` only.
5. Add `.devloop.yml` and `.devloop-policy.yml` from the example templates through a pull request.

Local server smoke test:

```bash
cp .env.example .env
npm run build
node dist/cli/index.js app serve --port 8787
```

## 8. Trigger A Self-Dogfood PR

```bash
bash scripts/create-self-dogfood-failure.sh
```

Then create or open the PR:

```bash
gh pr create \
  --title "test: self-dogfood DevLoop CI autofix" \
  --body "Intentional failing test to verify DevLoop can diagnose, patch, validate, and open a reviewable fix."
```

Trigger the GitHub App:

```bash
gh pr comment --body "/devloop dry-run"
gh pr comment --body "/devloop fix"
```

GitHub Action alternative:

1. Ensure `.github/workflows/devloop-autofix.yml` is present in the target branch.
2. Let the intentional CI failure complete.
3. Run the DevLoop workflow manually or from the failed workflow trigger.

## 9. Create The Alpha Tag

After CI, security, release readiness, and self-dogfood pass:

```bash
git checkout main
git pull --ff-only
git tag v0.1.0-alpha.0
git push origin v0.1.0-alpha.0
```

The release workflow will build, test, pack the npm tarball, and create a GitHub release.

Npm publishing is disabled by default. To enable trusted publishing:

1. Configure npm trusted publishing for `OWNER/devloop-ai`.
2. Set repository variable `NPM_PUBLISH=true`.
3. Push a new tag.

Do not add a long-lived `NPM_TOKEN` unless trusted publishing is unavailable.

## 10. Make The Repository Public

Only make the repository public after:

- CI passes on `main`,
- security workflow passes,
- `scripts/verify-public-release-ready.sh` passes,
- self-dogfood PR succeeds,
- release notes are reviewed,
- no local secrets or private evidence bundles are tracked.

GitHub CLI:

```bash
gh repo edit OWNER/devloop-ai --visibility public
```

Manual alternative:

1. Go to `Settings -> General -> Danger Zone`.
2. Change visibility to public.
3. Re-run CI and security workflows after visibility changes.
