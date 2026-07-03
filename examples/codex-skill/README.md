# Codex Skill Example

Install the bundled skill:

```bash
mkdir -p ~/.agents/skills
cp -R .agents/skills/devloop-autofix ~/.agents/skills/
```

Prompt Codex:

```text
Use the devloop-autofix skill. The CI log is in ci.log and the validation command is npm test. Diagnose, dry-run, apply only if safe, then rerun tests.
```

Safety expectations:

- inspect logs first,
- prefer minimal patches,
- dry-run before applying,
- do not edit secrets,
- do not disable tests or checks,
- report tests run and files changed.
