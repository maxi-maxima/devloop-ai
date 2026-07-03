import { readTextFile } from '../utils/text-file.js';

export interface SecurityLocation {
  uri: string;
  startLine?: number;
}

export interface SecurityAlert {
  index: number;
  runIndex: number;
  resultIndex: number;
  ruleId: string;
  severity: string;
  message: string;
  scanner: string;
  locations: SecurityLocation[];
  codeFlows: Array<{ locations: SecurityLocation[] }>;
  ruleHelp?: string;
  cwe?: string;
}

export async function parseSarifFile(filePath: string): Promise<SecurityAlert[]> {
  return parseSarif(JSON.parse(await readTextFile(filePath)));
}

export function parseSarif(sarif: unknown): SecurityAlert[] {
  const root = asRecord(sarif);
  if (root.version !== '2.1.0') {
    throw new Error(`Unsupported SARIF version: ${String(root.version)}`);
  }
  const runs = array(root.runs);
  let index = 0;
  const alerts: SecurityAlert[] = [];

  runs.forEach((runValue, runIndex) => {
    const run = asRecord(runValue);
    const driver = asRecord(asRecord(run.tool).driver);
    const scanner = stringValue(driver.name, 'unknown');
    const ruleMap = new Map<string, Record<string, unknown>>();
    for (const ruleValue of array(driver.rules)) {
      const rule = asRecord(ruleValue);
      const id = stringValue(rule.id);
      if (id) {
        ruleMap.set(id, rule);
      }
    }

    array(run.results).forEach((resultValue, resultIndex) => {
      const result = asRecord(resultValue);
      const ruleId = stringValue(result.ruleId, `rule-${resultIndex}`);
      const rule = ruleMap.get(ruleId) ?? {};
      alerts.push({
        index: index++,
        runIndex,
        resultIndex,
        ruleId,
        severity: stringValue(result.level, 'warning'),
        message: messageText(result.message),
        scanner,
        locations: array(result.locations).map(parseLocation).filter((location) => location.uri),
        codeFlows: parseCodeFlows(result.codeFlows),
        ruleHelp: messageText(asRecord(rule.help)),
        cwe: extractCwe(rule)
      });
    });
  });

  return alerts;
}

function parseCodeFlows(value: unknown): Array<{ locations: SecurityLocation[] }> {
  return array(value).flatMap((flowValue) =>
    array(asRecord(flowValue).threadFlows).map((threadFlow) => ({
      locations: array(asRecord(threadFlow).locations)
        .map((location) => parseLocation(asRecord(location).location))
        .filter((location) => location.uri)
    }))
  );
}

function parseLocation(value: unknown): SecurityLocation {
  const physical = asRecord(asRecord(value).physicalLocation);
  const artifact = asRecord(physical.artifactLocation);
  const region = asRecord(physical.region);
  return {
    uri: stringValue(artifact.uri),
    startLine: typeof region.startLine === 'number' ? region.startLine : undefined
  };
}

function messageText(value: unknown): string {
  const message = asRecord(value);
  return stringValue(message.text) || stringValue(message.markdown);
}

function extractCwe(rule: Record<string, unknown>): string | undefined {
  const tags = array(asRecord(rule.properties).tags).filter((tag): tag is string => typeof tag === 'string');
  const cweTag = tags.find((tag) => /cwe-\d+/i.test(tag));
  const cwe = cweTag?.match(/cwe[-/](\d+)/i)?.[1];
  return cwe ? `CWE-${Number.parseInt(cwe, 10)}` : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
