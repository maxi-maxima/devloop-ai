# DevLoop AutoFix Safety

DevLoop must preserve validation integrity.

Forbidden changes:

- `.env` files, secrets, private keys, credentials, tokens
- disabling or deleting tests to make CI pass
- disabling lint, type checks, or security checks
- broad refactors unrelated to the failure
- binary file changes
- lockfile edits unless explicitly allowed
- GitHub workflow permission changes unless explicitly allowed

Safe patch checklist:

1. The diagnosis cites evidence from the log.
2. The patch touches the fewest files possible.
3. The changed files match the stack trace or failing test.
4. The test command fails before the fix and passes after the fix.
5. Remaining risk is summarized honestly.
