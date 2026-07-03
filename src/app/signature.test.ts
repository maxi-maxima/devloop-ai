import { describe, expect, test } from 'vitest';
import { computeGitHubSignature, verifyGitHubSignature } from './signature.js';

describe('GitHub webhook signature verification', () => {
  test('matches the official GitHub SHA-256 webhook test vector', () => {
    const payload = 'Hello, World!';
    const secret = "It's a Secret to Everybody";
    const signature =
      'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';

    expect(computeGitHubSignature(secret, payload)).toBe(signature);
    expect(verifyGitHubSignature({ secret, payload: Buffer.from(payload), signatureHeader: signature })).toBe(
      true
    );
  });

  test('rejects missing, malformed, or mismatched signatures', () => {
    const payload = Buffer.from('{"ok":true}');
    const secret = 'secret';

    expect(verifyGitHubSignature({ secret, payload, signatureHeader: undefined })).toBe(false);
    expect(verifyGitHubSignature({ secret, payload, signatureHeader: 'sha1=abc' })).toBe(false);
    expect(verifyGitHubSignature({ secret, payload, signatureHeader: computeGitHubSignature('wrong', payload) })).toBe(
      false
    );
  });
});
