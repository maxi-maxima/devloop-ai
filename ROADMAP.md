# Roadmap

DevLoop is focused on safe, reproducible autofix workflows.

## Product Shape

### V1: CI AutoFix Agent

- CLI diagnosis and autofix loop.
- Deterministic 30-second demo.
- GitHub Action template.
- FixBench benchmark suite.

### V2: GitHub App + Security Autofix + MCP Tool Layer

- GitHub App webhook routing and comment commands.
- SARIF-based Security Autofix.
- Transport-agnostic tool contracts for MCP-compatible integrations.
- Codex Skill workflow.

### V3: Agent Firewall + Evidence Bundles + Agent Adapters

- Agent Firewall for prompt injection, secret exposure, dangerous commands, and unsafe patches.
- Evidence bundles for auditable runs.
- Codex, placeholder, and custom external agent adapters.
- FirewallBench benchmark suite.

### V4: Organization/Fleet Control Plane

- Organization scan, status, rollout, and policy sync.
- Shared policy rollout through PRs.
- Dry-run defaults for organization-wide operations.
- Fleet reports for maintainers.

## Near Term

- Production-ready stdio MCP server.
- Stronger workspace allowlist enforcement for tool adapters.
- Richer GitHub App job execution for SARIF artifacts.
- More FixBench cases from public repositories.
- Clearer model cost and token reporting.
- Better sandbox runner isolation.

## Later

- Multi-language architecture graph context.
- Hosted dashboard for self-hosted deployments.
- Policy packs for organizations.
- Provider-specific CI log collectors.
- Patch review model ensemble.
- Reproducible public benchmark leaderboard.

## Non-Goals

- Auto-merging PRs.
- Replacing maintainers.
- Offensive security tooling.
- Broad codebase rewrites by default.
