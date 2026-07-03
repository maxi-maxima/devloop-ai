# Changelog

All notable changes to DevLoop AI will be documented in this file.

## 0.1.0-alpha.0

Initial public alpha release candidate.

### Added

- CI AutoFix CLI for diagnosis, patch generation, test reruns, and PR creation.
- GitHub App webhook mode for failed workflow routing and slash commands.
- SARIF Security Autofix for safe, minimal security remediation previews.
- MCP-ready tool contracts for diagnosis, autofix, patch review, firewall checks, security autofix, and benchmarks.
- Agent Firewall for prompt injection, secret exposure, dangerous command, and unsafe patch checks.
- Evidence bundles for auditable diagnosis, redacted logs, patch diffs, validation commands, and hashes.
- Agent adapters for Codex, custom commands, and placeholder integrations.
- FixBench and FirewallBench benchmark suites.
- Organization fleet mode for scan, status, rollout planning, and policy sync.

### Security

- Dry-run defaults for risky automation paths.
- Forbidden-file and patch guardrails for secrets, workflows, tests, and lockfiles.
- Redaction for logs, prompts, and evidence output.
- Release readiness scripts and GitHub workflows for CI, security, and tagged releases.
