# DevLoop Tool Interface

DevLoop tools are small, transport-agnostic function contracts around the existing CLI capabilities. They exist so the same diagnose, autofix, patch review, and Agent Firewall behavior can be reused by the CLI today and by future MCP servers, Codex Skills, GitHub Actions, or other coding agents later.

This is not an MCP server yet. The tool layer only defines:

- `name`
- `description`
- `inputSchema`
- `outputSchema`
- `execute(input)`

## Available Tools

### `devloop.diagnose`

Analyzes failed CI or test logs and returns structured diagnosis JSON.

Input:

- `repoPath`
- `logText` or `logFile`

Output:

- `Diagnosis`

### `devloop.autofix`

Reads a failing log file, diagnoses the failure, generates a unified diff, validates safety, optionally applies the patch, and reruns the test command.

Input:

- `repoPath`
- `logFile`
- `testCommand`
- `dryRun`
- `maxRetries`

Output:

- `AutoFixResult`, including an `evidence` reference with `runId` and local bundle path

### `devloop.reviewPatch`

Reviews a unified diff using DevLoop safety rules without applying it.

Input:

- `repoPath`
- `patch`

Output:

- `SafetyCheckResult`

### `devloop.firewall.checkInput`

Detects prompt injection and secret exposure in untrusted text.

Input:

- `source`
- `text` or `file`
- optional `repoPath`

Output:

- `FirewallResult`

### `devloop.firewall.checkCommand`

Checks shell command risk before an agent executes it.

Input:

- `command`
- optional `repoPath`

Output:

- `FirewallResult`

### `devloop.firewall.checkPatch`

Checks a unified diff for unsafe edits, secret exposure, disabled tests, and supply-chain risk.

Input:

- `repoPath`
- `patch` or `patchFile`

Output:

- `FirewallResult`

### `devloop.firewall.scanRepo`

Scans repository instruction and automation files.

Input:

- `repoPath`

Output:

- `FirewallResult`

### `devloop.firewall.redact`

Redacts known API keys, tokens, private keys, and generic high-entropy secrets.

Input:

- `text` or `file`

Output:

- `RedactionResult`

## Future MCP Usage

A future MCP server can register each DevLoop tool by mapping:

- `tool.name` to the MCP tool name
- `tool.description` to the MCP tool description
- `tool.inputSchema` to the MCP input schema
- `tool.execute` to the MCP handler

Because the tools do not know about MCP, HTTP, GitHub Actions, or Codex runtime APIs, integrations can choose their own transport without duplicating DevLoop logic.

## Code Examples

Import the registry:

```ts
import { devloopTools } from 'devloop-ai/tools';

for (const tool of devloopTools) {
  console.log(tool.name, tool.description);
}
```

Run diagnosis:

```ts
import { diagnoseTool } from 'devloop-ai/tools';

const diagnosis = await diagnoseTool.execute({
  repoPath: process.cwd(),
  logFile: './ci.log'
});

console.log(diagnosis.summary);
```

Preview an autofix:

```ts
import { autofixTool } from 'devloop-ai/tools';

const result = await autofixTool.execute({
  repoPath: process.cwd(),
  logFile: './ci.log',
  testCommand: 'npm test',
  dryRun: true,
  maxRetries: 1
});

console.log(result.status);
console.log(result.changedFiles);
console.log(result.evidence?.runId);
```

Review a patch:

```ts
import { patchReviewTool } from 'devloop-ai/tools';

const safety = await patchReviewTool.execute({
  repoPath: process.cwd(),
  patch: unifiedDiff
});

if (!safety.passed) {
  console.error(safety.errors.join('\n'));
}
```
