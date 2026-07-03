# Security Policy

Please do not report vulnerabilities through public issues.

## Reporting a Vulnerability

Email or privately contact the maintainers with:

- affected version or commit,
- impact,
- reproduction steps,
- whether secrets or private data are involved,
- suggested remediation if known.

Do not include real credentials, production tokens, private SARIF artifacts, or private CI logs in public channels.

## Scope

In scope:

- secret leakage in DevLoop output,
- unsafe patch application,
- path traversal in repository or artifact handling,
- GitHub App webhook verification issues,
- PR creation behavior that bypasses repository policy,
- Security Autofix behavior that weakens security or suppresses scanners.

Out of scope:

- attacks against third-party repositories without authorization,
- exploit payload development,
- social engineering,
- denial-of-service testing against public infrastructure.

## Safe Automation Policy

DevLoop must not:

- auto-merge PRs,
- edit `.env` or secret files,
- hardcode credentials,
- disable auth or authorization,
- weaken validation to silence scanners,
- delete tests to make CI pass.

Security fixes should be minimal, reviewable, and validated.
