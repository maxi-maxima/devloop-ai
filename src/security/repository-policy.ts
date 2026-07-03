import { RepositoryPolicy, defaultRepositoryPolicy } from '../app/config.js';

const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export interface ActorAuthorizationInput {
  login?: string;
  association?: string;
  policy?: RepositoryPolicy;
}

export function isAllowedActor(input: ActorAuthorizationInput): boolean {
  const policy = input.policy ?? defaultRepositoryPolicy();
  const allowedUsers = new Set(policy.comments.allowedUsers.map((user) => user.toLowerCase()));
  if (input.login && allowedUsers.has(input.login.toLowerCase())) {
    return true;
  }
  if (allowedUsers.has('maintainers') && input.association && TRUSTED_ASSOCIATIONS.has(input.association)) {
    return true;
  }
  return false;
}
