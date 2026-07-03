# Example Codex Prompts

Use these when asking Codex to run DevLoop AutoFix.

```text
The CI log is in ci.log. Use DevLoop to diagnose the failure, preview a safe patch, apply it if safe, and rerun npm test.
```

```text
This repository has a failing build. Use the devloop-autofix skill with LOG_FILE=build.log and TEST_COMMAND="npm test". Do not edit secrets or disable tests.
```

```text
Run a dry-run DevLoop autofix first. Show me the suspected root cause, files changed, risk level, and the exact validation command before applying anything.
```
