# GitHub Action Example

Use this when you want DevLoop to react to failed GitHub Actions runs.

## Setup

```bash
mkdir -p .github/workflows
cp templates/github-actions/devloop-autofix.yml .github/workflows/devloop-autofix.yml
```

Add repository secrets:

```text
OPENAI_API_KEY
GITHUB_TOKEN is provided by GitHub Actions
```

Edit the copied workflow:

- set the watched CI workflow name,
- set the validation command,
- keep `--dry-run` until the output looks safe,
- only allow PR creation after maintainers approve the workflow.

## Example Validation Command

```bash
devloop autofix \
  --repo . \
  --log-file ./ci.log \
  --test-command "npm test" \
  --max-retries 3 \
  --dry-run
```
