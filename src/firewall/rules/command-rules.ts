import type { CommandRule } from '../types.js';

export const lowRiskCommands = [
  'npm test',
  'npm run test',
  'npm run lint',
  'pnpm test',
  'yarn test',
  'pytest',
  'go test ./...',
  'cargo test'
];

export const commandRules: CommandRule[] = [
  {
    id: 'cmd.remote-shell-curl',
    severity: 'critical',
    pattern: /\bcurl\b[^\n|;]+(\||;)\s*(sudo\s+)?(bash|sh|zsh|powershell|pwsh)\b/i,
    message: 'Command pipes a remote curl response into a shell.',
    recommendation: 'Download, inspect, pin, and verify scripts before execution.',
    decision: 'block'
  },
  {
    id: 'cmd.remote-shell-wget',
    severity: 'critical',
    pattern: /\bwget\b[^\n|;]+(\||;)\s*(sudo\s+)?(bash|sh|zsh|powershell|pwsh)\b/i,
    message: 'Command pipes a remote wget response into a shell.',
    recommendation: 'Block remote shell execution from untrusted sources.',
    decision: 'block'
  },
  {
    id: 'cmd.process-substitution',
    severity: 'critical',
    pattern: /\b(bash|sh|zsh)\s+<\(\s*(curl|wget)\b/i,
    message: 'Command executes a remote script through process substitution.',
    recommendation: 'Require human approval and script review before execution.',
    decision: 'block'
  },
  {
    id: 'cmd.env-dump',
    severity: 'critical',
    pattern: /(^|[;&|]\s*)(printenv|env)(\s|$)/i,
    message: 'Command prints environment variables that may contain secrets.',
    recommendation: 'Block environment dumps and use scoped diagnostics instead.',
    decision: 'block'
  },
  {
    id: 'cmd.secret-file-read',
    severity: 'critical',
    pattern: /\b(cat|type|less|more|Get-Content)\s+((\.env(\.|$|\s))|(~\/\.ssh\/|\$HOME\/\.ssh\/|\.npmrc|\.pypirc|\.docker\/config\.json))/i,
    message: 'Command reads a known secret-bearing file.',
    recommendation: 'Block reads of secret files and redact paths in reports.',
    decision: 'block'
  },
  {
    id: 'cmd.gh-secret',
    severity: 'critical',
    pattern: /\bgh\s+secret\b/i,
    message: 'Command accesses GitHub secrets.',
    recommendation: 'Never expose or mutate repository secrets from an autonomous run.',
    decision: 'block'
  },
  {
    id: 'cmd.force-push',
    severity: 'high',
    pattern: /\bgit\s+push\b[^\n]*\s--force(?:-with-lease)?\b/i,
    message: 'Command force-pushes git history.',
    recommendation: 'Require explicit human approval for history rewriting.',
    decision: 'require_human_approval'
  },
  {
    id: 'cmd.rm-root',
    severity: 'critical',
    pattern: /\brm\s+-[^\n]*r[^\n]*f[^\n]*(\s+\/|\s+\*)/i,
    message: 'Command recursively deletes root or wildcard paths.',
    recommendation: 'Block destructive recursive deletion.',
    decision: 'block'
  },
  {
    id: 'cmd.chmod-777',
    severity: 'high',
    pattern: /\bchmod\s+-R\s+777\b/i,
    message: 'Command grants broad write permissions recursively.',
    recommendation: 'Require human review and use least-privilege permissions.',
    decision: 'require_human_approval'
  },
  {
    id: 'cmd.npm-git-url',
    category: 'supply_chain_risk',
    severity: 'high',
    pattern: /\b(npm|yarn|pnpm)\s+(install|add)\b[^\n]*(git\+|github:|https?:\/\/)/i,
    message: 'Package manager installs code from a remote URL.',
    recommendation: 'Pin trusted packages through the registry or require review.',
    decision: 'require_human_approval'
  },
  {
    id: 'cmd.pip-url',
    category: 'supply_chain_risk',
    severity: 'high',
    pattern: /\bpip(?:3)?\s+install\b[^\n]*(https?:\/\/|git\+)/i,
    message: 'pip installs code from a remote URL.',
    recommendation: 'Require human approval and pinned hashes for remote installs.',
    decision: 'require_human_approval'
  },
  {
    id: 'cmd.docker-privileged',
    severity: 'high',
    pattern: /\bdocker\s+run\b[^\n]*(--privileged|-v\s+\/:|--mount\s+type=bind,source=\/)/i,
    message: 'Docker command grants privileged or host-root access.',
    recommendation: 'Run containers with least privilege and scoped mounts.',
    decision: 'require_human_approval'
  },
  {
    id: 'cmd.base64-shell',
    severity: 'critical',
    pattern: /\bbase64\b[^\n]*(--decode|-d)[^\n]*(\||;)\s*(bash|sh|zsh|powershell|pwsh)\b/i,
    message: 'Command decodes base64 content and executes it in a shell.',
    recommendation: 'Block obfuscated shell execution.',
    decision: 'block'
  }
];
