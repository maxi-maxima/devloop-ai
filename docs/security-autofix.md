# Security Autofix

Security Autofix reads SARIF 2.1.0 output from CodeQL, Semgrep, ESLint, and similar static analyzers, selects one or more alerts, proposes a minimal patch, validates policy guardrails, runs tests, and can open a security-focused pull request.

The goal is safe remediation, not alert suppression. If DevLoop cannot identify a small root-cause fix, it returns `DEVLOOP_CANNOT_FIX_SAFELY` and leaves the repository unchanged.

## CLI

```bash
devloop security-autofix \
  --sarif ./results.sarif \
  --repo . \
  --dry-run \
  --test-command "npm test"
```

Apply the patch after reviewing the dry run:

```bash
devloop security-autofix \
  --sarif ./results.sarif \
  --repo . \
  --test-command "npm test"
```

Useful filters:

```bash
devloop security-autofix --sarif results.sarif --repo . --rule-id "js/xss-escaping" --dry-run
devloop security-autofix --sarif results.sarif --repo . --severity error --max-alerts 3 --dry-run
devloop security-autofix --sarif results.sarif --repo . --alert-index 0 --dry-run
```

Options:

| Option | Purpose |
|---|---|
| `--sarif <path>` | SARIF 2.1.0 file to read. |
| `--repo <path>` | Repository to patch and validate. |
| `--rule-id <id>` | Process only alerts with this SARIF rule id. |
| `--alert-index <number>` | Process one zero-based alert index after filtering. |
| `--severity <level>` | Process only alerts at a SARIF level such as `error`, `warning`, or `note`. |
| `--dry-run` | Preview and safety-check the patch without applying it. |
| `--max-alerts <number>` | Maximum alerts to process. Defaults to `1`. |
| `--one-pr-per-alert` | Open one PR per fixed alert instead of one combined PR. |
| `--test-command <command>` | Validation command to run after applying a patch. |
| `--max-retries <number>` | Maximum patch attempts per alert. |

## SARIF Support

DevLoop parses:

- `runs`
- `results`
- `ruleId`
- `level`
- `message`
- `locations`
- `physicalLocation`
- `artifactLocation.uri`
- `region.startLine`
- `codeFlows.threadFlows.locations`
- rule help text
- CWE tags when provided by the scanner

The parser requires `version: "2.1.0"`. See the [OASIS SARIF 2.1.0 specification](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) and [GitHub SARIF support notes](https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support).

## Safety Policy

Security Autofix rejects patches that:

- suppress the scanner rule without fixing the root cause,
- add ignore comments as the primary fix,
- delete tests,
- weaken validation,
- disable authentication or authorization,
- log secrets,
- hardcode credentials,
- edit `.env` or secret files,
- edit workflow permissions unless explicitly allowed,
- introduce broad refactors.

Generated diffs also pass the shared DevLoop patch guardrails before any file is modified.

## Pull Request Body

Security PRs include:

- alert metadata: rule id, severity, affected file, scanner,
- root cause,
- fix summary,
- validation commands and results,
- safety notes that the patch is AI-generated and requires human review,
- DevLoop metadata: provider, model, attempt count, and sandbox runner.

## GitHub App Mode

Repository policy can point DevLoop at SARIF artifacts:

```yaml
security:
  enabled: true
  sarifPaths:
    - results.sarif
```

Maintainers can request the security workflow from a PR or issue comment:

```text
/devloop security-fix
```

The app command is routed through the same repository policy checks as other mutating DevLoop commands.

## Fixtures

DevLoop ships safe educational fixtures under `fixtures/security-sarif/`:

- `js-xss-escaping`
- `js-path-traversal-normalization`
- `js-hardcoded-secret-placeholder`
- `py-sql-query-parameterization`
- `ts-unsafe-json-validation`

Each fixture contains a SARIF file, vulnerable code, a failing or regression test, and an expected safe fix description. They are intentionally small and do not include real credentials, exploit payloads, or offensive tooling.

Run the security autofix test suite:

```bash
npm test -- src/security-autofix/security-autofix.test.ts
```
