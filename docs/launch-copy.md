# Launch Copy

Core message:

DevLoop is an open-source firewall and autofix agent for AI coding agents. It turns failed CI and security alerts into tested pull requests, with sandboxing, prompt-injection defense, secret redaction, patch review, and evidence bundles.

## 1. GitHub Release Announcement

DevLoop AI `v0.1.0-alpha.0` is the first public alpha.

DevLoop reads failed CI logs and SARIF security alerts, diagnoses the issue, generates a minimal patch, reruns tests, and opens a human-reviewable PR. The alpha also includes a GitHub App mode, GitHub Action template, MCP server, Codex Skill, Agent Firewall, Evidence Bundles, FixBench, FirewallBench, and sandbox runner support.

This is alpha software: no auto-merge, human review required, and Docker is recommended for stronger sandboxing.

Try it:

```bash
git clone https://github.com/maxi-maxima/devloop-ai.git
cd devloop-ai
npm install
npm run build
./scripts/demo-autofix.sh
```

Release notes: `docs/releases/v0.1.0-alpha.0.md`

## 2. Hacker News Post

Title:

Show HN: DevLoop AI - open-source CI autofix agent that opens tested PRs

Post:

I am building DevLoop AI, an open-source firewall and autofix agent for AI coding agents.

The goal is to turn failed CI and security alerts into tested pull requests, not just summaries. DevLoop reads logs or SARIF, diagnoses the failure, generates a minimal patch, reruns the validation command, and writes evidence about what changed.

The first alpha includes CI AutoFix, Security Autofix from SARIF, GitHub App mode, a GitHub Action template, MCP server, Codex Skill, Agent Firewall, Evidence Bundles, FixBench, FirewallBench, and sandbox runner support.

It is intentionally conservative: no auto-merge, dry-run defaults where appropriate, forbidden secret/env edits, patch review, and human review required.

I would especially like feedback from maintainers who have real flaky or recurring CI failures, and from people building MCP or coding-agent tooling.

## 3. Reddit r/programming Post

Title:

DevLoop AI: open-source agent that turns failed CI into tested pull requests

Body:

I released the first public alpha of DevLoop AI, an open-source firewall and autofix agent for AI coding agents.

It is meant to sit around the risky parts of AI coding workflows: failed CI logs, patch generation, local test execution, PR creation, and security alerts. Instead of auto-merging, DevLoop produces a pull request with diagnosis, patch summary, validation result, firewall report, sandbox metadata, and an evidence bundle.

Included in `v0.1.0-alpha.0`:

- CI AutoFix
- Security Autofix from SARIF
- GitHub App mode
- GitHub Action template
- MCP server
- Codex Skill
- Agent Firewall
- Evidence Bundles
- FixBench and FirewallBench
- Sandbox runner

This is alpha quality and human review is required. I am looking for feedback on real-world CI failures and benchmark cases.

## 4. Reddit r/devops Post

Title:

Open-source CI autofix agent with PRs, sandboxing, and evidence bundles

Body:

I am preparing the first public alpha of DevLoop AI.

The idea is straightforward: CI fails, DevLoop reads the logs, proposes a minimal patch, reruns the test command, and opens a pull request with evidence instead of silently changing code.

For DevOps and platform teams, the relevant pieces are:

- GitHub App mode for workflow failures and slash commands,
- GitHub Action template for failed workflow autofix,
- dry-run and no-auto-merge defaults,
- sandbox runner support,
- firewall checks for dangerous commands and unsafe patches,
- evidence bundles for auditability,
- FixBench and FirewallBench for reproducible evaluation.

It is alpha quality, so I would not enable write mode broadly yet. The intended rollout is dry-run first, then selected repositories, then reviewable PR creation.

## 5. X/Twitter Thread

1. DevLoop AI `v0.1.0-alpha.0` is ready for public alpha.

It is an open-source firewall and autofix agent for AI coding agents.

2. CI failed?

DevLoop reads the logs, diagnoses the issue, patches the bug, reruns tests, and opens a pull request.

No auto-merge. Human review stays in the loop.

3. It also supports Security Autofix from SARIF, so CodeQL/Semgrep/ESLint-style alerts can become safe minimal PRs when DevLoop can fix them confidently.

4. The alpha includes:

CI AutoFix, GitHub App mode, GitHub Action template, MCP server, Codex Skill, Agent Firewall, Evidence Bundles, FixBench, FirewallBench, and sandbox runner support.

5. The safety layer matters:

sandboxing, prompt-injection defense, secret redaction, forbidden file checks, patch review, and evidence bundles.

6. This is alpha software.

Some fixes will fail. Docker is recommended for sandboxing. Human review is required.

7. I am looking for real CI failures and benchmark cases from maintainers.

Repo: https://github.com/maxi-maxima/devloop-ai

## 6. LinkedIn Post

I am releasing the first public alpha of DevLoop AI.

DevLoop is an open-source firewall and autofix agent for AI coding agents. It turns failed CI and security alerts into tested pull requests, with sandboxing, prompt-injection defense, secret redaction, patch review, and evidence bundles.

The goal is not to replace maintainers. The goal is to take the repetitive first pass: read the logs, identify the likely root cause, prepare a minimal patch, run the validation command, and open a PR that a human can review.

The alpha includes CI AutoFix, Security Autofix from SARIF, GitHub App mode, a GitHub Action template, MCP server, Codex Skill, Agent Firewall, Evidence Bundles, FixBench, FirewallBench, and sandbox runner support.

It is early, conservative, and intentionally no-auto-merge. I am especially interested in feedback from maintainers, DevOps teams, security engineers, and people building AI developer tools.

## 7. Short Demo Caption

CI fails. DevLoop reads the log, diagnoses the root cause, generates a minimal patch, reruns the test, and opens a PR with evidence. Open-source, no auto-merge, human review required.
