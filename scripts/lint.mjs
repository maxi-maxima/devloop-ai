#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const roots = ['src', 'scripts'];
const ignoredDirs = new Set(['node_modules', 'dist', 'coverage', '.devloop', 'benchmark-results', 'firewallbench-results']);
const checkedExtensions = new Set(['.ts', '.js', '.mjs', '.sh']);
const errors = [];

for (const root of roots) {
  await walk(path.join(repoRoot, root));
}

if (errors.length > 0) {
  console.error('DevLoop lint failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('DevLoop lint passed.');

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(fullPath);
      }
      continue;
    }
    if (!entry.isFile() || !checkedExtensions.has(path.extname(entry.name))) {
      continue;
    }
    await lintFile(fullPath);
  }
}

async function lintFile(filePath) {
  const relative = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const text = await readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/^(<<<<<<<|=======|>>>>>>>)\b/.test(line)) {
      errors.push(`${relative}:${index + 1} contains a merge conflict marker`);
    }
    if (line.trim().length > 0 && /[ \t]+$/.test(line)) {
      errors.push(`${relative}:${index + 1} has trailing whitespace`);
    }
    if (/\b(?:describe|it|test)\.only\s*\(/.test(line)) {
      errors.push(`${relative}:${index + 1} contains a focused test`);
    }
  });
}
