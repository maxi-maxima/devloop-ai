#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const version = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });

if (version.error?.code === 'ENOENT') {
  console.log('gitleaks is not installed; skipping local secret scan.');
  console.log('');
  console.log('Install gitleaks and rerun:');
  console.log('  macOS:   brew install gitleaks');
  console.log('  Windows: winget install Gitleaks.Gitleaks');
  console.log('  Linux:   https://github.com/gitleaks/gitleaks#installing');
  console.log('');
  console.log('CI still runs dependency audit and the GitHub security workflow can run gitleaks when configured.');
  process.exit(0);
}

if (version.status !== 0) {
  process.stderr.write(version.stderr || version.stdout || 'Unable to run gitleaks version.\n');
  process.exit(version.status ?? 1);
}

const scan = spawnSync('gitleaks', ['dir', '.', '--redact', '--no-banner'], {
  stdio: 'inherit'
});

process.exit(scan.status ?? 1);
