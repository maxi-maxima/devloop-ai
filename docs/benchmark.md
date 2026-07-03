# Benchmarks

DevLoop uses FixBench to measure whether the autofix loop can reproduce safe fixes from clean fixtures.

## Run

```bash
devloop bench list
devloop bench run --provider fixture --output benchmark-results
devloop bench report
```

## Current Baseline

| Model | Pass@1 | Pass@3 | Median Time | Median Files Changed |
|---|---:|---:|---:|---:|
| fixture/fixture-oracle | 100.0% | 100.0% | 310 ms | 1 |

Source: `benchmark-results/results.json`.

## Metrics

FixBench reports:

- pass@1,
- pass@3,
- total cases,
- solved and failed cases,
- unsafe patch rejections,
- average attempts,
- median runtime,
- median files changed,
- median lines changed,
- provider/model,
- DevLoop version,
- timestamp,
- machine info.

Each case also records the diagnosis summary, files changed, test result, failure reason, and patch diff path.

## Interpreting Results

The fixture provider is an oracle mode for validating DevLoop's harness, patch application, guardrails, and reporting. It does not measure LLM reasoning quality.

Use model providers for real model evaluation:

```bash
devloop bench run --provider openai --model gpt-4.1-mini --output benchmark-results-openai
```

See [docs/fixbench.md](./fixbench.md) for suite structure and CI integration.
