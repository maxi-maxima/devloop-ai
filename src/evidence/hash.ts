import { createHash, randomBytes } from 'node:crypto';

export function sha256(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

export function createRunId(prefix = 'run'): string {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
}
