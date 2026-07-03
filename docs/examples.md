# Examples

## Local CI Autofix

```bash
devloop diagnose --repo . --log-file ./ci.log
devloop autofix --repo . --log-file ./ci.log --test-command "npm test" --dry-run
devloop autofix --repo . --log-file ./ci.log --test-command "npm test" --no-pr
```

## GitHub App Comments

```text
/devloop diagnose
/devloop dry-run
/devloop fix
/devloop security-fix
/devloop rerun
```

## Security Autofix

```bash
devloop security-autofix \
  --repo . \
  --sarif ./results.sarif \
  --rule-id "js/xss-escaping" \
  --dry-run \
  --test-command "npm test"
```

## FixBench

```bash
devloop bench list
devloop bench run --provider fixture --output benchmark-results
devloop bench report
```

## Codex Prompts

```text
Use the devloop-autofix skill. The CI log is in ci.log and the validation command is npm test. Diagnose, dry-run, apply only if safe, then rerun tests.
```

```text
This repository has a failing build. Use DevLoop to produce a minimal safe patch. Do not edit secrets or disable tests.
```

```text
Use DevLoop Security Autofix on results.sarif. Preview the patch first and summarize risk before applying anything.
```

## MCP-Ready Tool Interface

```ts
import { diagnoseTool, autofixTool, patchReviewTool } from 'devloop-ai/tools';

const diagnosis = await diagnoseTool.execute({
  repoPath: process.cwd(),
  logText: 'AssertionError: expected 3 to equal 4'
});

const review = await patchReviewTool.execute({
  repoPath: process.cwd(),
  patchText: '--- a/src/app.js\n+++ b/src/app.js\n@@ -1 +1 @@\n-old\n+new\n'
});
```
