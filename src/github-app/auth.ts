import { createSign } from 'node:crypto';

export interface GitHubAppJwtInput {
  appId: string;
  privateKey: string;
  clientId?: string;
  now?: Date;
}

export function createGitHubAppJwt(input: GitHubAppJwtInput): string {
  const nowSeconds = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const payload = {
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
    iss: input.clientId ?? input.appId
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(input.privateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

export function decodeJwtPart(part: string): Record<string, unknown> {
  const padded = part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<
    string,
    unknown
  >;
}

function base64UrlJson(value: unknown): string {
  return base64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
