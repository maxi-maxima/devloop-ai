# Self-Dogfood Fixture

This fixture is intentionally tiny and safe. On `main`, it passes. The self-dogfood scripts create a branch that changes one line in `src/user.js` from a safe fallback to a null/undefined handling bug:

```diff
-  const name = (user.name ?? 'Anonymous').trim();
+  const name = user.name.trim();
```

That branch fails `npm test`, giving DevLoop a realistic CI failure it can diagnose and patch without touching production code.
