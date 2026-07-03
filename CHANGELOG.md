# Changelog

All notable changes to DevLoop AI will be documented in this file.

## v0.1.0-alpha.1

Launch-readiness correction release.

### Highlights

- Corrects the README quickstart clone URL for the public repository.
- Updates the public alpha checklist to reflect the published prerelease and required post-public protection steps.
- Updates the GitHub hardening report with final public visibility safeguards.
- Keeps npm publishing intentionally deferred.

### Notes

- No runtime product code changes from `v0.1.0-alpha.0`.
- Supersedes `v0.1.0-alpha.0` as the recommended public alpha release.

## v0.1.0-alpha.0

First public alpha release candidate.

### Highlights

- CI AutoFix
- Security Autofix from SARIF
- GitHub App mode
- GitHub Action template
- MCP server
- Codex Skill
- Agent Firewall
- Evidence Bundles
- FixBench
- FirewallBench
- Sandbox Runner

### Included

- CLI commands for diagnosis, autofix, security autofix, benchmarks, firewall checks, agent adapters, and org fleet mode.
- GitHub App webhook mode for failed workflow routing and slash commands.
- GitHub Action template for CI autofix.
- GitHub workflow hardening for Dependabot PR security scans and current official action pins.
- SARIF parsing and safe security patch generation.
- MCP-compatible stdio server and transport-agnostic tool contracts.
- Codex Skill package for reusable CI autofix workflows.
- Agent Firewall checks for prompt injection, secret exposure, dangerous commands, unsafe patches, and malicious repo instructions.
- Evidence bundles with diagnosis, redacted logs, patch diffs, validation commands, firewall reports, sandbox metadata, and hashes.
- FixBench and FirewallBench reproducible benchmark suites.
- Docker and local sandbox runner abstractions.

### Known limitations

- Alpha quality.
- Human review required.
- No auto-merge.
- Some fixes may fail.
- Docker recommended for sandboxing.
