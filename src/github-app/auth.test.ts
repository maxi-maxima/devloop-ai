import { createPrivateKey, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createGitHubAppJwt, decodeJwtPart } from './auth.js';

describe('GitHub App JWT auth', () => {
  test('creates an RS256 JWT with GitHub App claims', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const token = createGitHubAppJwt({
      appId: '12345',
      privateKey: pem,
      now: new Date('2026-07-03T00:00:00Z')
    });

    const [headerPart, payloadPart, signaturePart] = token.split('.');
    expect(decodeJwtPart(headerPart!)).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    expect(decodeJwtPart(payloadPart!)).toMatchObject({
      iss: '12345',
      iat: 1783036740,
      exp: 1783037340
    });

    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      createPublicKey(createPrivateKey(pem)),
      Buffer.from(signaturePart!.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    );
    expect(valid).toBe(true);
  });
});
