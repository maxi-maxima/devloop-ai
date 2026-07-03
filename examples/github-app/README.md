# GitHub App Example

This example shows a minimal repository policy for self-hosted GitHub App mode.

## `.devloop.yml`

```yaml
enabled: true
autofix:
  enabled: true
  mode: "dry-run"
  maxRetries: 3
  testCommand: "npm test"
  allowLockfileEdits: false
  allowNetwork: false

security:
  enabled: true
  sarifPaths:
    - results.sarif

comments:
  enabled: true
  commands:
    - help
    - diagnose
    - dry-run
    - fix
    - security-fix
    - rerun
```

Start DevLoop:

```bash
devloop app serve
```

Comment on a PR:

```text
/devloop dry-run
```
