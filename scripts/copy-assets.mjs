import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const promptSource = path.join(root, 'src', 'ai', 'prompts');
const promptTarget = path.join(root, 'dist', 'ai', 'prompts');

await mkdir(promptTarget, { recursive: true });
await cp(promptSource, promptTarget, { recursive: true });
