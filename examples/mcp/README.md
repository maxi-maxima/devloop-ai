# MCP-Ready Tool Example

DevLoop does not ship a stdio MCP server in this launch build. It exposes typed tools that MCP adapters can register.

## Example Adapter Shape

```ts
import { diagnoseTool, autofixTool, patchReviewTool } from 'devloop-ai/tools';

export const tools = [diagnoseTool, autofixTool, patchReviewTool];
```

Safe defaults for adapters:

```json
{
  "allowedWorkspaces": ["."],
  "allowWrite": false,
  "allowNetwork": false,
  "allowLocalRunner": false,
  "maxRetries": 1
}
```

Prompt:

```text
Use DevLoop to diagnose this failing test log and generate a dry-run patch only.
```
