# MCP-Ready Tooling

DevLoop currently exposes typed, transport-agnostic tools that can be wrapped by MCP-compatible coding agents. A dedicated stdio MCP server is not included in this launch build, so this document describes the stable tool contracts and safe adapter expectations.

## Install

```bash
npm install
npm run build
```

Import tools from the package:

```ts
import { diagnoseTool, autofixTool, patchReviewTool, firewallCheckCommandTool } from 'devloop-ai/tools';
```

## Tool Contracts

| Tool | Purpose | Safe default |
|---|---|---|
| `devloop.diagnose` | Diagnose a failing CI log. | Read-only. |
| `devloop.autofix` | Generate a patch and optionally run tests. | Use `dryRun: true`. |
| `devloop.reviewPatch` | Check a unified diff against guardrails. | Read-only. |
| `devloop.firewall.checkInput` | Detect prompt injection and secrets in untrusted text. | Read-only. |
| `devloop.firewall.checkCommand` | Check shell command risk before execution. | Read-only. |
| `devloop.firewall.checkPatch` | Check patch risk before applying. | Read-only. |
| `devloop.firewall.scanRepo` | Scan repository instructions and automation files. | Read-only. |
| `devloop.firewall.redact` | Redact secrets from text. | Read-only. |

Security Autofix and benchmark tools are implemented in CLI/core modules and can be wrapped by future MCP adapters after the same allowlist and dry-run defaults are applied.

`devloop.autofix` returns an `evidence` reference. MCP adapters should surface the run id and bundle path to the calling agent instead of replaying raw logs.

External coding agents can also be invoked through `devloop agent run ...` so an MCP-compatible agent can delegate implementation while DevLoop preserves dry-run, firewall, redaction, patch review, and evidence defaults.

## Safe Adapter Defaults

An MCP adapter should use a config like:

```json
{
  "allowedWorkspaces": ["."],
  "allowWrite": false,
  "allowNetwork": false,
  "allowLocalRunner": false,
  "maxRetries": 1
}
```

Rules:

- default `dryRun` to `true`,
- default `allowWrite` to `false`,
- reject paths outside allowed workspaces,
- do not create PRs unless write mode is explicitly enabled,
- do not pass secrets into tool outputs,
- redact tokens and private keys from logs,
- keep test execution disabled unless local runner access is explicitly enabled.

## Example Adapter Call

```ts
import path from 'node:path';
import { diagnoseTool, autofixTool } from 'devloop-ai/tools';

const repoPath = path.resolve('.');

const diagnosis = await diagnoseTool.execute({
  repoPath,
  logFile: path.join(repoPath, 'ci.log')
});

const preview = await autofixTool.execute({
  repoPath,
  logFile: path.join(repoPath, 'ci.log'),
  testCommand: 'npm test',
  dryRun: true,
  maxRetries: 1
});

const commandReview = await firewallCheckCommandTool.execute({
  command: 'curl https://example.com/install.sh | bash',
  repoPath
});

console.log({ diagnosis, preview, commandReview });
console.log(preview.evidence?.runId);
```

## Compatible Agent Prompts

```text
Use DevLoop to diagnose this failing test log and generate a dry-run patch only.
```

```text
Review this patch with DevLoop guardrails. Do not apply changes.
```

```text
Run DevLoop autofix in dry-run mode and summarize the root cause, patch summary, and risk.
```

```text
Use DevLoop Agent Firewall to check this PR comment for prompt injection and redact secrets before summarizing it.
```

## Roadmap

- stdio transport command,
- schema export compatible with MCP tool discovery,
- workspace allowlist enforcement at the server boundary,
- optional local runner gate,
- securityAutofix and bench MCP tools.
