Return only a unified diff.

Security patch rules:
- Fix the root cause described by the SARIF alert.
- Do not suppress the scanner rule unless explicitly justified by the diagnosis.
- Do not add ignore comments as the primary fix.
- Minimize changed files.
- Preserve legitimate behavior.
- Add focused regression tests where appropriate.
- Never edit secrets or .env files.
- Never weaken validation, authentication, authorization, sandboxing, or logging safety.
- If a safe minimal patch is unclear, return exactly:

DEVLOOP_CANNOT_FIX_SAFELY
