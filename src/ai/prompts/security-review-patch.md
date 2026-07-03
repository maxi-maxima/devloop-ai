Review this generated security patch and return STRICT JSON only:

{
  "approved": true,
  "risk_level": "low|medium|high",
  "issues": [],
  "reason": ""
}

Reject patches that:
- weaken security controls,
- silence scanners instead of fixing root cause,
- add ignore comments as the primary fix,
- delete tests,
- edit secrets or .env files,
- change workflow permissions without explicit approval,
- introduce broad refactors unrelated to the alert.
