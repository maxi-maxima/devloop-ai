# FixBench

FixBench is DevLoop's reproducible benchmark suite for CI autofix behavior. It runs small broken repositories from a clean fixture copy, captures the failing logs, runs DevLoop's diagnose/autofix loop, reruns tests, and writes JSON, Markdown, and HTML reports.

## Commands

```bash
devloop bench list
devloop bench run
devloop bench report
```

Run the default deterministic suite:

```bash
devloop bench run --provider fixture --output benchmark-results
```

Run with a model-backed provider:

```bash
devloop bench run \
  --provider openai \
  --model gpt-4.1-mini \
  --max-retries 3 \
  --concurrency 2
```

The default `fixture` provider is an oracle provider that returns each case's known minimal patch. It is useful for checking DevLoop's benchmark harness, guardrails, patch application, test rerun, and report generation without external services. Use `openai`, `anthropic`, or `ollama` to benchmark model-generated patches.

## Outputs

FixBench writes:

```text
benchmark-results/results.json
benchmark-results/report.md
benchmark-results/report.html
benchmark-results/cases/<case-id>/failing.log
benchmark-results/cases/<case-id>/patch.diff
benchmark-results/cases/<case-id>/result.json
```

## Reproducibility

Each case:

- copies a broken fixture into an isolated temp directory,
- runs the expected failing command first,
- saves failing logs and generated patches,
- reruns the configured test command,
- removes the temp workdir unless `--keep-workdir` is set,
- avoids network access unless a case explicitly marks `requiresNetwork`.

## Metrics

Reports include:

- `pass@1`
- `pass@3`
- total, solved, failed, and unsafe cases
- average attempts
- median runtime
- median files changed
- median lines changed
- provider/model
- DevLoop version
- timestamp
- machine info

## CI

`.github/workflows/fixbench.yml` runs a small fixture-oracle subset on pull requests and the full benchmark on manual `workflow_dispatch`.
