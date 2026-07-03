import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyGitHubSignatureInput {
  secret: string;
  payload: Buffer | string;
  signatureHeader?: string;
}

export function computeGitHubSignature(secret: string, payload: Buffer | string): string {
  const digest = createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${digest}`;
}

export function verifyGitHubSignature(input: VerifyGitHubSignatureInput): boolean {
  if (!input.signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expected = Buffer.from(computeGitHubSignature(input.secret, input.payload), 'utf8');
  const actual = Buffer.from(input.signatureHeader, 'utf8');
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
