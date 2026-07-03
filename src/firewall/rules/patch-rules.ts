export const forbiddenSecretFilePatterns = [
  /^\.env(?:\.|$)/,
  /(?:^|\/)\.env(?:\.|$)/,
  /(?:^|\/)\.npmrc$/,
  /(?:^|\/)\.pypirc$/,
  /(?:^|\/)\.docker\/config\.json$/,
  /(?:^|\/)id_rsa$/,
  /\.(?:pem|key|p12|pfx)$/
];

export const testFilePattern = /(?:^|\/)(?:test|tests|__tests__|spec)(?:\/|$)|\.(?:test|spec)\.[A-Za-z0-9]+$/;

export const authSensitivePathPattern = /(?:^|\/)(auth|authorization|permissions?|roles?|rbac|acl|security)(?:\/|[-_.])/i;
