import { validatePatchSafety } from '../core/guardrails.js';
import type { SafetyCheckResult } from '../core/types.js';
import {
  assertMatchesSchema,
  DevLoopTool,
  JsonSchema,
  safetyCheckResultSchema
} from './types.js';

export interface PatchReviewToolInput {
  repoPath: string;
  patch: string;
  allowLockfile?: boolean;
  allowWorkflowPermissions?: boolean;
  maxFiles?: number;
}

export const patchReviewInputSchema = {
  type: 'object',
  required: ['repoPath', 'patch'],
  additionalProperties: false,
  properties: {
    repoPath: {
      type: 'string',
      minLength: 1,
      description: 'Absolute or relative path to the repository the patch targets.'
    },
    patch: {
      type: 'string',
      minLength: 1,
      description: 'Unified diff patch text to review before applying.'
    },
    allowLockfile: {
      type: 'boolean',
      default: false,
      description: 'Allow package manager lockfile changes.'
    },
    allowWorkflowPermissions: {
      type: 'boolean',
      default: false,
      description: 'Allow edits to GitHub Actions workflow permissions blocks.'
    },
    maxFiles: {
      type: 'integer',
      minimum: 1,
      default: 5,
      description: 'Maximum number of files the patch may touch.'
    }
  }
} satisfies JsonSchema;

export const patchReviewTool: DevLoopTool<PatchReviewToolInput, SafetyCheckResult> = {
  name: 'devloop.reviewPatch',
  description:
    'Review a unified diff for DevLoop safety rules, forbidden files, lockfiles, and patch blast radius.',
  inputSchema: patchReviewInputSchema,
  outputSchema: safetyCheckResultSchema,
  async execute(input) {
    assertMatchesSchema(patchReviewInputSchema, input, 'devloop.reviewPatch input');

    const result = validatePatchSafety(input.patch, {
      allowLockfile: input.allowLockfile,
      allowWorkflowPermissions: input.allowWorkflowPermissions,
      maxFiles: input.maxFiles
    });

    assertMatchesSchema(safetyCheckResultSchema, result, 'devloop.reviewPatch output');
    return result;
  }
};
