# Organization Fleet Mode

DevLoop organization fleet mode helps maintainers roll out CI autofix, security autofix, firewall policy, and evidence bundle defaults across many repositories in one GitHub organization.

Fleet mode is intentionally conservative:

- scans and reports are read-only,
- rollout and policy sync are dry-run by default,
- generated changes are proposed through pull requests,
- PR mode is never enabled across an organization unless `--confirm-pr-mode` is passed,
- no direct commits are made to default branches.

## Configuration

Create `devloop-org.yml`:

```yaml
organization: my-org
defaults:
  mode: dry-run
  maxRetries: 2
  allowNetwork: false
  firewallMode: strict
repositories:
  include:
    - "*"
  exclude:
    - "legacy-*"
    - "archived-*"
```

Set a GitHub token with repository metadata and pull request permissions:

```bash
GITHUB_TOKEN=ghp_xxx
```

## Scan

```bash
devloop org scan --config devloop-org.yml --output devloop-org-report.md
```

The scan lists installed repositories and detects:

- primary language,
- GitHub Actions workflows,
- likely test command,
- security scanners such as CodeQL, Semgrep, ESLint, and Bandit,
- `.devloop.yml`,
- `.devloop-policy.yml`,
- recent DevLoop job summaries when available.

The report includes:

```markdown
| Repo | Language | CI | Test Command | DevLoop Config | Firewall | Last Status |
|---|---|---|---|---|---|---|
```

## Status

```bash
devloop org status --config devloop-org.yml
```

Status prints the fleet summary:

- repositories enabled,
- repositories in dry-run mode,
- repositories in PR mode,
- recent DevLoop jobs,
- success rate,
- blocked firewall events,
- security autofix count.

It also writes the same Markdown report as `org scan`.

## Rollout

```bash
devloop org rollout --config devloop-org.yml
```

By default this writes `devloop-org-rollout-plan.json` and does not create remote PRs. The plan shows which repositories need:

- `.devloop.yml`,
- `.devloop-policy.yml`,
- `.github/workflows/devloop-autofix.yml` when no DevLoop Action exists.

To create rollout PRs, pass `--no-dry-run`:

```bash
devloop org rollout --config devloop-org.yml --no-dry-run
```

If `defaults.mode` is `pr`, DevLoop still writes `mode: dry-run` unless you explicitly confirm the organization-wide mode switch:

```bash
devloop org rollout --config devloop-org.yml --confirm-pr-mode --no-dry-run
```

## Policy Sync

```bash
devloop org policy sync --config devloop-org.yml
```

This writes `devloop-org-policy-sync-plan.json` with the desired `.devloop-policy.yml` and a diff for each repository.

Override policy defaults from the CLI:

```bash
devloop org policy sync \
  --config devloop-org.yml \
  --firewall-mode strict \
  --output devloop-org-policy-sync-plan.json
```

To open policy sync PRs:

```bash
devloop org policy sync --config devloop-org.yml --no-dry-run
```

## Safety Notes

Fleet mode should be used as a maintainer workflow, not a silent background mutator. Review generated plans before using `--no-dry-run`, keep `mode: dry-run` during initial rollout, and enable PR mode repository by repository once maintainers trust the local validation setup.

Generated PRs include human-review language and only add DevLoop configuration, policy, and workflow files. DevLoop does not auto-merge organization rollout changes.
