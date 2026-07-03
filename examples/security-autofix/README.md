# Security Autofix Example

Run against one of the included safe fixtures:

```bash
devloop security-autofix \
  --repo fixtures/security-sarif/js-xss-escaping \
  --sarif fixtures/security-sarif/js-xss-escaping/results.sarif \
  --dry-run \
  --test-command "node test.js"
```

Expected behavior:

- SARIF alert is parsed,
- DevLoop selects the alert,
- a minimal escaping patch is previewed,
- scanner suppression is rejected by policy,
- applying without `--dry-run` runs the validation command.

Do not use real credentials, exploit payloads, or private SARIF logs in examples.
