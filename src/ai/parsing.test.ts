import { describe, expect, test } from 'vitest';
import { parseAnalysisResponse, parseFixResponse } from './parsing.js';

describe('AI response parsing', () => {
  test('extracts analysis JSON from fenced model output', () => {
    const analysis = parseAnalysisResponse(`
      Here is the result:
      \`\`\`json
      {
        "architectureSummary": "Small TypeScript CLI.",
        "bugs": [{"title": "Missing validation", "severity": "medium", "file": "src/index.ts", "evidence": "Input is trusted"}],
        "riskyFiles": [{"file": "src/index.ts", "reason": "Entrypoint"}],
        "recommendedFix": {"title": "Validate input", "file": "src/index.ts", "rationale": "Avoid crashes", "expectedChange": "Add guard"}
      }
      \`\`\`
    `);

    expect(analysis.recommendedFix.file).toBe('src/index.ts');
    expect(analysis.bugs[0]?.severity).toBe('medium');
  });

  test('extracts fix JSON with patch description and file replacement', () => {
    const fix = parseFixResponse(`
      {
        "summary": "Validate CLI input.",
        "patchDescription": "Replace src/index.ts with a guarded implementation.",
        "changes": [
          {"file": "src/index.ts", "content": "console.log('safe');\\n"}
        ]
      }
    `);

    expect(fix.patchDescription).toContain('guarded');
    expect(fix.changes).toEqual([
      { file: 'src/index.ts', content: "console.log('safe');\n" }
    ]);
  });
});
