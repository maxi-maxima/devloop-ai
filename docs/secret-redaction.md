# Secret Redaction

DevLoop redacts secrets before reporting firewall evidence or PR bodies.

## Detected Secret Types

- GitHub tokens,
- OpenAI API keys,
- Anthropic API keys,
- AWS access keys,
- Google API keys,
- Slack tokens,
- Stripe live keys,
- private key blocks,
- generic high-entropy values assigned to names such as `token`, `secret`, `password`, or `api_key`.

## Redaction Labels

Secrets are replaced with labels such as:

- `[REDACTED_GITHUB_TOKEN]`
- `[REDACTED_OPENAI_KEY]`
- `[REDACTED_PRIVATE_KEY]`
- `[REDACTED_SECRET]`

The raw value should never appear in logs, firewall reports, or PR bodies.

## CLI

```bash
devloop firewall check-input --source ci_log --file failed-log.txt
```

The returned `sanitizedText` contains redacted text.
