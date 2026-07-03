# DevLoop Policy

Repositories can configure Agent Firewall behavior with `.devloop-policy.yml`.

```yaml
firewall:
  mode: strict
  requireHumanApproval:
    - dangerous_command
    - unsafe_patch
    - supply_chain_risk
  block:
    - secret_exposure
    - prompt_injection
  allowedCommands:
    - npm test
    - npm run lint
    - pytest
  deniedCommands:
    - printenv
    - cat .env
    - curl * | bash
  maxPatchFiles: 5
  allowNetwork: false
  allowWorkflowPermissionChanges: false
```

## Modes

- `strict`: default for GitHub App mode. Blocks prompt injection, secrets, and dangerous commands.
- `default`: default for local CLI mode. Blocks prompt injection and secrets, requires approval for risky commands and patches.
- `permissive`: useful for local experimentation. Still blocks secret exposure.

## Patch Limits

`maxPatchFiles` limits blast radius. Workflow permission changes are blocked unless `allowWorkflowPermissionChanges` is true.

## Network Policy

When `allowNetwork` is false, commands containing network access such as `curl`, `wget`, or `Invoke-WebRequest` are flagged.
