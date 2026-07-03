# DevLoop 30-second Demo

The demo shows DevLoop fixing a failing test in a tiny Node.js fixture.

## What It Does

`scripts/demo-autofix.sh` performs these steps:

1. Copies `fixtures/failing-node-repo/` into a temporary directory.
2. Runs `npm install` inside the temporary fixture.
3. Runs `npm test` and captures the expected failure.
4. Runs `devloop autofix --dry-run --demo` to show the diagnosis and patch preview.
5. Runs `devloop autofix --demo` to apply the patch.
6. Runs `npm test` again to prove the fix.
7. Prints the final `git diff`.

The demo uses `--demo`, which enables polished terminal output and a deterministic built-in fixture patch. No OpenAI API key is required for the demo.

## Expected Story

The fixture has a small realistic bug:

- `src/user.js` assumes `user.name` always exists.
- `test/user.test.js` verifies that missing names become `Anonymous`.
- The first test run fails with a `TypeError`.
- DevLoop generates a one-file unified diff patch.
- The second test run passes.

## Run It

```bash
git clone <repo>
cd devloop-ai
npm install
npm run build
./scripts/demo-autofix.sh
```

Set `KEEP_DEVLOOP_DEMO=1` to keep the temporary workspace after the run.
