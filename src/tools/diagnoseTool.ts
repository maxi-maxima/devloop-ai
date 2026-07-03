import path from 'node:path';
import { diagnoseCiFailure } from '../core/diagnoser.js';
import type { Diagnosis } from '../core/types.js';
import { readTextFile } from '../utils/text-file.js';
import {
  assertMatchesSchema,
  DevLoopTool,
  diagnosisSchema,
  JsonSchema
} from './types.js';

export interface DiagnoseToolInput {
  repoPath: string;
  logText?: string;
  logFile?: string;
}

export const diagnoseInputSchema = {
  type: 'object',
  required: ['repoPath'],
  additionalProperties: false,
  anyOf: [
    { type: 'object', required: ['logText'] },
    { type: 'object', required: ['logFile'] }
  ],
  properties: {
    repoPath: {
      type: 'string',
      minLength: 1,
      description: 'Absolute or relative path to the repository to diagnose.'
    },
    logText: {
      type: 'string',
      minLength: 1,
      description: 'Raw failing CI or test log text.'
    },
    logFile: {
      type: 'string',
      minLength: 1,
      description: 'Path to a file containing failing CI or test logs.'
    }
  }
} satisfies JsonSchema;

export const diagnoseTool: DevLoopTool<DiagnoseToolInput, Diagnosis> = {
  name: 'devloop.diagnose',
  description:
    'Analyze failing CI or test logs for a repository and return structured root-cause diagnosis JSON.',
  inputSchema: diagnoseInputSchema,
  outputSchema: diagnosisSchema,
  async execute(input) {
    assertMatchesSchema(diagnoseInputSchema, input, 'devloop.diagnose input');

    const repoPath = path.resolve(input.repoPath);
    const log = input.logText ?? (await readTextFile(path.resolve(input.logFile!)));
    const diagnosis = await diagnoseCiFailure({ repoPath, log });

    assertMatchesSchema(diagnosisSchema, diagnosis, 'devloop.diagnose output');
    return diagnosis;
  }
};
