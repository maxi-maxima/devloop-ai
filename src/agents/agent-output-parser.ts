export function extractPatchFromAgentOutput(output: string): string {
  const lines = output.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^---\s+(?:a\/|\S)/.test(line));
  if (start === -1) {
    return '';
  }

  const patchLines: string[] = [];
  for (const line of lines.slice(start)) {
    if (line.trim() === '```') {
      break;
    }
    patchLines.push(line);
  }

  const patch = patchLines
    .filter((line) => line.trim() !== '```diff' && line.trim() !== '```patch')
    .join('\n');
  return patch.endsWith('\n') ? patch : `${patch}\n`;
}
