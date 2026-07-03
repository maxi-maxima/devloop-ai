import type { AutoFixResult, Diagnosis, SafetyCheckResult, TestResult } from '../core/types.js';

export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: readonly unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  default?: unknown;
  anyOf?: JsonSchema[];
}

export interface DevLoopTool<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  execute(input: TInput): Promise<TOutput>;
}

export class ToolValidationError extends Error {
  constructor(
    message: string,
    readonly errors: string[]
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

export function assertMatchesSchema(schema: JsonSchema, value: unknown, label = 'value'): void {
  const errors = validateAgainstSchema(schema, value);
  if (errors.length > 0) {
    throw new ToolValidationError(`${label} failed schema validation: ${errors.join('; ')}`, errors);
  }
}

export function validateAgainstSchema(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const errors: string[] = [];

  if (schema.anyOf) {
    const matched = schema.anyOf.some((candidate) => validateAgainstSchema(candidate, value, path).length === 0);
    if (!matched) {
      errors.push(`${path} must match at least one allowed shape`);
    }
  }

  if (schema.type) {
    errors.push(...validateType(schema, value, path));
    if (errors.some((error) => error.startsWith(`${path} must be`))) {
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path} must contain at least ${schema.minLength} character(s)`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
  }

  if (schema.properties || schema.required) {
    if (!isRecord(value)) {
      errors.push(`${path} must be an object`);
      return errors;
    }

    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value) || value[key] === undefined) {
        errors.push(`${path}.${key} is required`);
      }
    }

    const properties = schema.properties ?? {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value && value[key] !== undefined) {
        errors.push(...validateAgainstSchema(propertySchema, value[key], `${path}.${key}`));
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }
  }

  if (schema.items) {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return errors;
    }

    value.forEach((item, index) => {
      errors.push(...validateAgainstSchema(schema.items!, item, `${path}[${index}]`));
    });
  }

  return errors;
}

export const stringArraySchema = {
  type: 'array',
  items: { type: 'string' }
} satisfies JsonSchema;

export const diagnosisSchema = {
  type: 'object',
  required: [
    'summary',
    'failing_command',
    'failing_tests',
    'error_messages',
    'stack_traces',
    'likely_files',
    'root_cause_hypothesis',
    'confidence',
    'recommended_fix_strategy',
    'needs_human_review'
  ],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    failing_command: { type: 'string' },
    failing_tests: stringArraySchema,
    error_messages: stringArraySchema,
    stack_traces: stringArraySchema,
    likely_files: stringArraySchema,
    root_cause_hypothesis: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    recommended_fix_strategy: { type: 'string' },
    needs_human_review: { type: 'boolean' }
  }
} satisfies JsonSchema;

export const safetyCheckResultSchema = {
  type: 'object',
  required: ['passed', 'errors', 'warnings', 'changedFiles', 'forbiddenFiles'],
  additionalProperties: false,
  properties: {
    passed: { type: 'boolean' },
    errors: stringArraySchema,
    warnings: stringArraySchema,
    changedFiles: stringArraySchema,
    forbiddenFiles: stringArraySchema
  }
} satisfies JsonSchema;

export const testResultSchema = {
  type: 'object',
  required: ['command', 'exitCode', 'stdout', 'stderr', 'durationMs', 'passed', 'timedOut'],
  additionalProperties: false,
  properties: {
    command: { type: 'string' },
    exitCode: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    stdout: { type: 'string' },
    stderr: { type: 'string' },
    durationMs: { type: 'number', minimum: 0 },
    passed: { type: 'boolean' },
    timedOut: { type: 'boolean' }
  }
} satisfies JsonSchema;

export const evidenceReferenceSchema = {
  type: 'object',
  required: ['runId', 'path'],
  additionalProperties: false,
  properties: {
    runId: { type: 'string', minLength: 1 },
    path: { type: 'string', minLength: 1 }
  }
} satisfies JsonSchema;

export const autoFixResultSchema = {
  type: 'object',
  required: ['status', 'attempts', 'diagnosis', 'changedFiles', 'safety'],
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['fixed', 'dry-run', 'failed', 'unsafe', 'needs-human-review']
    },
    attempts: { type: 'integer', minimum: 1 },
    diagnosis: diagnosisSchema,
    patch: { type: 'string' },
    changedFiles: stringArraySchema,
    safety: safetyCheckResultSchema,
    testResult: testResultSchema,
    prUrl: { type: 'string' },
    prBody: { type: 'string' },
    evidence: evidenceReferenceSchema,
    reason: { type: 'string' }
  }
} satisfies JsonSchema;

export type DiagnosisJson = Diagnosis;
export type AutoFixResultJson = AutoFixResult;
export type SafetyCheckResultJson = SafetyCheckResult;
export type TestResultJson = TestResult;

function validateType(schema: JsonSchema, value: unknown, path: string): string[] {
  switch (schema.type) {
    case 'object':
      return isRecord(value) ? [] : [`${path} must be an object`];
    case 'array':
      return Array.isArray(value) ? [] : [`${path} must be an array`];
    case 'string':
      return typeof value === 'string' ? [] : [`${path} must be a string`];
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? [] : [`${path} must be a number`];
    case 'integer':
      return Number.isInteger(value) ? [] : [`${path} must be an integer`];
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path} must be a boolean`];
    case 'null':
      return value === null ? [] : [`${path} must be null`];
    default:
      return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
