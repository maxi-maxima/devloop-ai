export interface CheckRunLogHint {
  summary: string;
  text: string;
  detailsUrl?: string;
}

export function extractCheckRunLogHint(checkRun: unknown): CheckRunLogHint {
  const value = isRecord(checkRun) ? checkRun : {};
  const output = isRecord(value.output) ? value.output : {};
  return {
    summary: typeof output.summary === 'string' ? output.summary : '',
    text: typeof output.text === 'string' ? output.text : '',
    detailsUrl: typeof value.details_url === 'string' ? value.details_url : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
