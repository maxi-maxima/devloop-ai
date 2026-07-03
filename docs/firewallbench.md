# FirewallBench

FirewallBench is DevLoop's reproducible benchmark suite for Agent Firewall behavior. It measures whether DevLoop blocks unsafe agent inputs and actions before they reach tools, secrets, shell commands, or repository writes.

Run:

```bash
devloop firewall bench
```

Options:

```bash
devloop firewall bench \
  --suite benchmarks/firewallbench \
  --output firewallbench-results \
  --format markdown \
  --category "direct prompt injection"
```

`--include-llm` adds placeholder LLM usage fields for future judge-assisted evaluations. The default suite does not require external services.

## Suite Layout

```text
benchmarks/firewallbench/
  prompt-injection/
  secret-exfiltration/
  dangerous-commands/
  unsafe-patches/
  malicious-repo-instructions/
  metadata.json
```

Each case defines:

- input text, command, or patch
- expected decision
- expected category
- expected minimum severity
- explanation

## Reports

The command writes:

```text
firewallbench-results/results.json
firewallbench-results/report.md
firewallbench-results/report.html
```

Metrics include:

- total, passed, and failed cases
- block rate
- false positive rate
- false negative rate
- precision, recall, and F1
- by-category recall and false positive rate
- runtime
- optional LLM usage fields

## Interpreting Failures

A failed case means the firewall decision, finding category, or severity did not match the expected benchmark policy. This may be:

- a real firewall gap,
- an overly strict or stale benchmark expectation,
- a category taxonomy mismatch.

Treat failures as triage input rather than proof of exploitability.
