# Agent Adapters

DevLoop Agent Adapters let you run external coding agents behind DevLoop's safety layer. DevLoop does not replace Codex, Claude Code, Cursor, or custom internal agents; it wraps them with firewall checks, secret redaction, patch review, dry-run defaults, validation, and evidence bundles.

## Commands

```bash
devloop agent list
devloop agent doctor

devloop agent run codex -- "fix failing tests"
devloop agent run claude-code -- "fix CI failure"
devloop agent run custom --command "my-agent --task task.txt"
```

External agents do not need to be installed for `list` or `doctor` to work. Missing binaries are reported with a helpful `Command not found on PATH` message.

## Safe Defaults

Agent runs default to:

- dry-run mode
- no write
- no push
- no network unless explicitly allowed
- no secrets passed into the agent environment
- prompt redaction before execution
- command firewall check before subprocess execution
- patch firewall check before application
- evidence bundle creation for every run

To allow DevLoop to apply a reviewed patch:

```bash
devloop agent run custom \
  --command "my-agent --task task.txt" \
  --no-dry-run \
  --allow-write \
  --test-command "npm test" \
  -- "fix the failing test"
```

## Codex Adapter

The Codex adapter builds commands like:

```bash
codex exec --cd <repo> --sandbox workspace-write --prompt-file <file>
```

Example:

```bash
devloop agent run codex \
  --repo . \
  --model gpt-5-mini \
  --sandbox workspace-write \
  --output-file .devloop/codex-output.txt \
  -- "fix failing tests with the smallest safe patch"
```

DevLoop writes the prompt to `.devloop/agents/<run>.md` after redaction. It does not pass secrets into the Codex environment. `danger-full-access` is rejected unless `--unsafe` is explicitly set.

## Custom Adapter

Use `custom` for internal agents, scripts, or local wrappers:

```bash
devloop agent run custom \
  --repo . \
  --command "node ./tools/my-agent.js" \
  -- "fix the failing test"
```

The custom command must pass the Agent Firewall command check. Its stdout/stderr are captured and redacted. DevLoop extracts the first unified diff from output, reviews it, and creates an evidence bundle.

## Pull Requests

Agent PR creation is opt-in and only meaningful after write mode applies a patch:

```bash
devloop agent run custom \
  --command "my-agent --task task.txt" \
  --no-dry-run \
  --allow-write \
  --test-command "npm test" \
  --pr \
  -- "fix the failing test"
```

DevLoop reuses the normal GitHub configuration and includes the evidence run id in the PR body.

## Configuration

Optional `.devloop-agents.yml`:

```yaml
agents:
  codex:
    enabled: true
    command: "codex"
    defaultArgs:
      - "exec"
    sandbox: "workspace-write"
  custom:
    enabled: false

defaults:
  dryRun: true
  allowWrite: false
  allowNetwork: false
  requirePatchReview: true
```

The current parser intentionally supports the small config shape above.

## Evidence

Each run writes:

```text
.devloop/evidence/<run-id>/
```

The bundle contains redacted agent output, patch diff, firewall report, sandbox metadata, hashes, and run metadata. Verify it with:

```bash
devloop evidence verify .devloop/evidence/<run-id>
```

## GitHub App Mode

GitHub App jobs can use the same adapter layer as a future execution backend: fetch logs, build a safe prompt, run the selected adapter in dry-run or write mode, review the patch, then open a human-reviewed PR with an evidence bundle.

## MCP Mode

MCP-compatible agents can call DevLoop tools first, then hand work to an adapter:

```text
Use DevLoop to run Codex in dry-run mode against this repo. Return only the diagnosis, patch summary, firewall result, and evidence run id.
```

MCP adapters should preserve DevLoop's defaults: dry-run true, allowWrite false, allowNetwork false, and no secret-bearing environment variables.
