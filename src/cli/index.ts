#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import dotenv from 'dotenv';
import { LlmClient } from '../ai/client.js';
import { AnalysisResult } from '../ai/parsing.js';
import { getAgentRegistry, loadAgentConfig } from '../agents/agent-registry.js';
import { runAgent } from '../agents/agent-runner.js';
import type { AgentSandboxMode, SupportedAgent } from '../agents/adapter-types.js';
import { startAppServer } from '../app/server.js';
import { loadBenchmarkSuite, regenerateBenchmarkReports, runBenchmarkSuite } from '../bench/index.js';
import { analyzeRepository } from '../core/analyzer.js';
import { formatDemoAutoFixResult } from '../core/demo-output.js';
import { generateAndApplyFix } from '../core/fixer.js';
import { createPrFromLocalChanges } from '../core/git-workflow.js';
import { applyUnifiedDiff, previewPatch } from '../core/patcher.js';
import { runFirewallBench, type FirewallBenchFormat } from '../firewallbench/index.js';
import {
  createEvidenceBundle,
  exportEvidenceBundle,
  verifyEvidenceBundle,
  type EvidenceExportFormat
} from '../evidence/index.js';
import {
  checkCommandRisk,
  checkInput,
  checkPatchRisk,
  loadFirewallPolicy,
  redactSecrets,
  scanRepositoryInstructions,
  type FirewallResult,
  type InputSource
} from '../firewall/index.js';
import {
  initRepository,
  loadState,
  saveState,
  workspacePathsForState
} from '../core/repository.js';
import { runSecurityAutofix } from '../security-autofix/index.js';
import {
  createPolicySyncPlan,
  createRolloutPlan,
  GitHubOrgClient,
  loadOrgConfig,
  scanOrganization,
  writeOrgReport,
  type DevLoopOrgConfig,
  type OrgFirewallMode,
  type OrgGitHubClient,
  type OrgScanReport,
  type PolicySyncPlan,
  type RolloutPlan
} from '../org/index.js';
import { autofixTool, diagnoseTool } from '../tools/index.js';
import { loadConfig, requireGitHubConfig, requireOpenAiConfig } from '../utils/config.js';
import { readTextFile } from '../utils/text-file.js';

dotenv.config({ quiet: true });

const program = new Command();

program
  .name('devloop')
  .description('Open-source CI autofix agent for failed builds and pull requests')
  .version('0.1.0');

program
  .command('diagnose')
  .description('Analyze failed CI logs and print structured root-cause JSON')
  .requiredOption('--log-file <path>', 'Path to a CI log file')
  .option('--repo <path>', 'Repository path', '.')
  .action(async (options: { logFile: string; repo: string }) => {
    const diagnosis = await diagnoseTool.execute({
      repoPath: path.resolve(options.repo),
      logFile: path.resolve(options.logFile)
    });

    console.log(JSON.stringify(diagnosis, null, 2));
  });

program
  .command('apply-patch')
  .description('Validate and safely apply a unified diff patch')
  .requiredOption('--patch <path>', 'Path to unified diff patch')
  .option('--repo <path>', 'Repository path', '.')
  .option('--dry-run', 'Validate and preview without applying', false)
  .option('--allow-lockfile', 'Allow lockfile edits', false)
  .action(async (options: { patch: string; repo: string; dryRun: boolean; allowLockfile: boolean }) => {
    const patch = await readTextFile(path.resolve(options.patch));
    const repoPath = path.resolve(options.repo);
    const result = options.dryRun
      ? await previewPatch(repoPath, patch, { allowLockfile: options.allowLockfile })
      : await applyUnifiedDiff(repoPath, patch, { allowLockfile: options.allowLockfile });

    console.log(JSON.stringify(result, null, 2));
    if (!result.safety.passed) {
      process.exitCode = 1;
    }
  });

const firewallCommand = program
  .command('firewall')
  .description('Detect prompt injection, dangerous commands, secret exposure, and unsafe patches');

firewallCommand
  .command('check-input')
  .description('Check untrusted text for prompt injection and secret exposure')
  .requiredOption('--source <source>', 'Input source, for example pr-comment, issue_comment, or ci_log')
  .option('--file <path>', 'Path to text file to scan')
  .option('--text <text>', 'Inline text to scan')
  .option('--repo <path>', 'Repository path for .devloop-policy.yml', '.')
  .action(async (options: { source: string; file?: string; text?: string; repo: string }) => {
    const text = options.text ?? (options.file ? await readTextFile(path.resolve(options.file)) : undefined);
    if (!text) {
      throw new Error('firewall check-input requires --file or --text.');
    }
    const policy = await loadFirewallPolicy(path.resolve(options.repo), 'cli');
    printFirewallResult(
      checkInput({
        source: parseInputSource(options.source),
        text,
        policy
      })
    );
  });

firewallCommand
  .command('check-command')
  .description('Check a shell command before an agent executes it')
  .requiredOption('--command <command>', 'Shell command to check')
  .option('--repo <path>', 'Repository path for .devloop-policy.yml', '.')
  .action(async (options: { command: string; repo: string }) => {
    const policy = await loadFirewallPolicy(path.resolve(options.repo), 'cli');
    printFirewallResult(checkCommandRisk(options.command, policy));
  });

firewallCommand
  .command('check-patch')
  .description('Check a unified diff before an agent applies it')
  .requiredOption('--patch <path>', 'Path to unified diff patch')
  .option('--repo <path>', 'Repository path for .devloop-policy.yml', '.')
  .action(async (options: { patch: string; repo: string }) => {
    const repoPath = path.resolve(options.repo);
    const policy = await loadFirewallPolicy(repoPath, 'cli');
    const patch = await readTextFile(path.resolve(options.patch));
    printFirewallResult(checkPatchRisk({ repoPath, patch }, policy));
  });

firewallCommand
  .command('scan')
  .description('Scan repository instructions and automation files for risky agent instructions')
  .option('--repo <path>', 'Repository path', '.')
  .action(async (options: { repo: string }) => {
    const repoPath = path.resolve(options.repo);
    const policy = await loadFirewallPolicy(repoPath, 'cli');
    const result = await scanRepositoryInstructions(repoPath, policy);
    const evidence = await createFirewallEvidence(repoPath, 'firewall.scan', result);
    console.log(JSON.stringify({ ...result, evidence }, null, 2));
    if (result.decision === 'block' || result.riskLevel === 'critical') {
      process.exitCode = 1;
    }
  });

firewallCommand
  .command('bench')
  .description('Run FirewallBench and write JSON, Markdown, and HTML reports')
  .option('--suite <path>', 'FirewallBench suite path', defaultFirewallBenchSuitePath())
  .option('--output <path>', 'FirewallBench output directory', 'firewallbench-results')
  .option('--format <format>', 'Primary report format: json, markdown, or html', parseFirewallBenchFormat, 'markdown')
  .option('--include-llm', 'Include placeholder LLM evaluation usage fields', false)
  .option('--category <category>', 'Run only a selected benchmark category')
  .action(
    async (options: {
      suite: string;
      output: string;
      format: FirewallBenchFormat;
      includeLlm: boolean;
      category?: string;
    }) => {
      const report = await runFirewallBench({
        suitePath: path.resolve(options.suite),
        outputPath: path.resolve(options.output),
        format: options.format,
        includeLlm: options.includeLlm,
        category: options.category
      });
      console.log(`FirewallBench completed: ${report.summary.passedCases}/${report.summary.totalCases} passed`);
      console.log(`Recall: ${(report.summary.recall * 100).toFixed(1)}%`);
      console.log(`False positive rate: ${(report.summary.falsePositiveRate * 100).toFixed(1)}%`);
      console.log(`Reports: ${path.resolve(options.output)}`);
      if (report.summary.failedCases > 0) {
        process.exitCode = 1;
      }
    }
  );

const evidenceCommand = program
  .command('evidence')
  .description('Inspect, verify, and export DevLoop fix evidence bundles');

evidenceCommand
  .command('show')
  .argument('<run-id>', 'Evidence run id')
  .option('--repo <path>', 'Repository path', '.')
  .description('Print evidence.json for a run id')
  .action(async (runId: string, options: { repo: string }) => {
    const bundlePath = path.join(path.resolve(options.repo), '.devloop', 'evidence', runId);
    console.log(await readFile(path.join(bundlePath, 'evidence.json'), 'utf8'));
  });

evidenceCommand
  .command('verify')
  .argument('<path>', 'Path to an evidence bundle directory')
  .description('Validate evidence schema, required files, and SHA-256 hashes')
  .action(async (bundlePath: string) => {
    const result = await verifyEvidenceBundle(path.resolve(bundlePath));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) {
      process.exitCode = 1;
    }
  });

evidenceCommand
  .command('export')
  .argument('<run-id>', 'Evidence run id')
  .option('--repo <path>', 'Repository path', '.')
  .option('--format <format>', 'Export format: json, zip, or markdown', parseEvidenceFormat, 'json')
  .option('--output <path>', 'Output directory', '.')
  .description('Export an evidence bundle as JSON, Markdown, or zip')
  .action(
    async (
      runId: string,
      options: { repo: string; format: EvidenceExportFormat; output: string }
    ) => {
      const result = await exportEvidenceBundle({
        runId,
        evidenceRoot: path.join(path.resolve(options.repo), '.devloop', 'evidence'),
        outputDir: path.resolve(options.output),
        format: options.format
      });
      console.log(`Exported ${result.format}: ${result.outputPath}`);
    }
  );

const agentCommand = program
  .command('agent')
  .description('Run external coding agents through DevLoop firewall, redaction, patch review, and evidence');

agentCommand
  .command('list')
  .description('List supported agent adapters and availability')
  .option('--repo <path>', 'Repository path for .devloop-agents.yml', '.')
  .action(async (options: { repo: string }) => {
    const repoPath = path.resolve(options.repo);
    const registry = getAgentRegistry();
    const config = await loadAgentConfig(repoPath);
    const availability = await registry.doctor(config);
    console.log(
      JSON.stringify(
        availability.map((item) => ({
          name: item.name,
          available: item.available,
          command: item.command,
          reason: item.reason
        })),
        null,
        2
      )
    );
  });

agentCommand
  .command('doctor')
  .description('Check agent adapter configuration and local command availability')
  .option('--repo <path>', 'Repository path for .devloop-agents.yml', '.')
  .action(async (options: { repo: string }) => {
    const repoPath = path.resolve(options.repo);
    const registry = getAgentRegistry();
    const config = await loadAgentConfig(repoPath);
    console.log(
      JSON.stringify(
        {
          defaults: config.defaults,
          agents: config.agents,
          availability: await registry.doctor(config)
        },
        null,
        2
      )
    );
  });

agentCommand
  .command('run')
  .argument('<agent>', 'Agent adapter: codex, claude-code, cursor-agent, or custom')
  .argument('[prompt...]', 'Task prompt for the agent')
  .option('--repo <path>', 'Repository path', '.')
  .option('--command <command>', 'Custom command or adapter command override')
  .option('--model <model>', 'Model option passed to adapters that support it')
  .option('--sandbox <mode>', 'Agent sandbox: read-only, workspace-write, or danger-full-access', parseAgentSandbox)
  .option('--output-file <path>', 'Adapter output file path when supported')
  .option('--test-command <command>', 'Validation command to run after applying a patch')
  .option('--dry-run', 'Capture and review patch without applying it', true)
  .option('--no-dry-run', 'Disable dry-run; requires --allow-write before patch application')
  .option('--allow-write', 'Allow DevLoop to apply the reviewed patch', false)
  .option('--allow-network', 'Allow network-capable commands through policy', false)
  .option('--unsafe', 'Allow explicitly unsafe adapter modes such as Codex danger-full-access', false)
  .option('--pr', 'Create a pull request after a completed write-mode run', false)
  .option('--base <branch>', 'Base branch for PR')
  .option('--branch <branch>', 'Branch name for PR')
  .allowUnknownOption(false)
  .description('Run an external coding agent through DevLoop guardrails')
  .action(
    async (
      agent: string,
      promptParts: string[],
      options: {
        repo: string;
        command?: string;
        model?: string;
        sandbox?: AgentSandboxMode;
        outputFile?: string;
        testCommand?: string;
        dryRun: boolean;
        allowWrite: boolean;
        allowNetwork: boolean;
        unsafe: boolean;
        pr: boolean;
        base?: string;
        branch?: string;
      }
    ) => {
      const prompt = promptParts.join(' ').trim();
      if (!prompt && agent !== 'custom') {
        throw new Error('agent run requires a prompt after --.');
      }
      const result = await runAgent({
        repoPath: path.resolve(options.repo),
        agent: parseSupportedAgent(agent),
        prompt: prompt || 'Run the configured coding agent task.',
        command: options.command,
        model: options.model,
        outputFile: options.outputFile ? path.resolve(options.outputFile) : undefined,
        sandbox: options.sandbox,
        testCommand: options.testCommand,
        dryRun: options.dryRun,
        allowWrite: options.allowWrite,
        allowNetwork: options.allowNetwork,
        unsafe: options.unsafe
      });

      if (result.status === 'completed' && options.pr) {
        const github = requireGitHubConfig(loadConfig());
        const pr = await createPrFromLocalChanges({
          repoPath: path.resolve(options.repo),
          token: github.token,
          title: `DevLoop Agent: ${agent} patch`,
          body: [
            '## Summary',
            `DevLoop ran the ${agent} adapter and reviewed the generated patch.`,
            '',
            '## Evidence Bundle',
            result.evidence ? `- Run ID: ${result.evidence.runId}` : '- Run ID: not available',
            result.evidence ? `- Evidence path: ${result.evidence.path}` : '- Evidence path: not available',
            '- Human review required: yes'
          ].join('\n'),
          base: options.base,
          branch: options.branch
        });
        result.prUrl = pr.url;
      }

      console.log(JSON.stringify(result, null, 2));
      if (result.status === 'blocked' || result.status === 'failed' || result.status === 'unsafe') {
        process.exitCode = 1;
      }
    }
  );

const orgCommand = program
  .command('org')
  .description('Manage DevLoop CI autofix, security autofix, firewall policy, and evidence across an organization');

orgCommand
  .command('scan')
  .description('Scan installed organization repositories for CI, languages, test commands, scanners, and DevLoop config')
  .option('--config <path>', 'Organization config path', 'devloop-org.yml')
  .option('--output <path>', 'Markdown report path', 'devloop-org-report.md')
  .action(async (options: { config: string; output: string }) => {
    const { report } = await loadOrgScan(options.config);
    await writeOrgReport(report, path.resolve(options.output));
    console.log(formatOrgSummary(report));
    console.log(`Report: ${path.resolve(options.output)}`);
  });

orgCommand
  .command('status')
  .description('Show organization DevLoop enablement, recent jobs, security autofix count, and firewall blocks')
  .option('--config <path>', 'Organization config path', 'devloop-org.yml')
  .option('--output <path>', 'Markdown report path', 'devloop-org-report.md')
  .action(async (options: { config: string; output: string }) => {
    const { report } = await loadOrgScan(options.config);
    await writeOrgReport(report, path.resolve(options.output));
    console.log(formatOrgSummary(report));
    console.log(`Report: ${path.resolve(options.output)}`);
  });

orgCommand
  .command('rollout')
  .description('Create a safe PR plan that adds DevLoop config, policy, and an optional GitHub Action')
  .option('--config <path>', 'Organization config path', 'devloop-org.yml')
  .option('--output <path>', 'Rollout plan JSON path', 'devloop-org-rollout-plan.json')
  .option('--confirm-pr-mode', 'Allow generated .devloop.yml files to use mode: pr', false)
  .option('--include-github-action', 'Include the DevLoop GitHub Action template when missing', true)
  .option('--no-include-github-action', 'Skip GitHub Action template generation')
  .option('--dry-run', 'Write the rollout plan without creating PRs', true)
  .option('--no-dry-run', 'Create rollout PRs for planned repository changes')
  .action(
    async (options: {
      config: string;
      output: string;
      confirmPrMode: boolean;
      includeGithubAction: boolean;
      dryRun: boolean;
    }) => {
      const { config, client, report } = await loadOrgScan(options.config);
      const plan = createRolloutPlan(report, config, {
        confirmPrMode: options.confirmPrMode,
        includeGitHubAction: options.includeGithubAction,
        dryRun: options.dryRun
      });
      if (!options.dryRun) {
        await createRolloutPullRequests(client, plan);
      }
      await writeJson(path.resolve(options.output), plan);
      const planned = plan.repositories.filter((repo) => repo.action === 'create-pr').length;
      console.log(`Org rollout plan: ${planned}/${plan.repositories.length} repositories need PRs`);
      console.log(`Dry run: ${plan.dryRun ? 'yes' : 'no'}`);
      console.log(`Plan: ${path.resolve(options.output)}`);
    }
  );

const orgPolicyCommand = orgCommand.command('policy').description('Manage shared DevLoop organization policy');

orgPolicyCommand
  .command('sync')
  .description('Create a dry-run policy synchronization plan for .devloop-policy.yml')
  .option('--config <path>', 'Organization config path', 'devloop-org.yml')
  .option('--output <path>', 'Policy sync plan JSON path', 'devloop-org-policy-sync-plan.json')
  .option('--firewall-mode <mode>', 'Firewall mode: strict, default, or permissive', parseOrgFirewallMode)
  .option('--allow-network', 'Allow network in the shared policy template', false)
  .option('--dry-run', 'Write the policy sync plan without creating PRs', true)
  .option('--no-dry-run', 'Create policy sync PRs for planned repository changes')
  .action(
    async (options: {
      config: string;
      output: string;
      firewallMode?: OrgFirewallMode;
      allowNetwork: boolean;
      dryRun: boolean;
    }) => {
      const { config, client, report } = await loadOrgScan(options.config);
      const plan = createPolicySyncPlan(report, {
        firewallMode: options.firewallMode ?? config.defaults.firewallMode,
        allowNetwork: options.allowNetwork,
        dryRun: options.dryRun
      });
      if (!options.dryRun) {
        await createPolicySyncPullRequests(client, plan, report);
      }
      await writeJson(path.resolve(options.output), plan);
      const changed = plan.repositories.filter((repo) => repo.changed).length;
      console.log(`Org policy sync plan: ${changed}/${plan.repositories.length} repositories need updates`);
      console.log(`Dry run: ${plan.dryRun ? 'yes' : 'no'}`);
      console.log(`Plan: ${path.resolve(options.output)}`);
    }
  );

program
  .command('autofix')
  .description('Diagnose failed CI, generate a minimal patch, rerun tests, and optionally open a PR')
  .option('--repo <path>', 'Repository path', '.')
  .requiredOption('--log-file <path>', 'Path to a failed CI log file')
  .requiredOption('--test-command <command>', 'Command used to validate the fix')
  .option('--max-retries <number>', 'Maximum fix attempts', parseInteger, 3)
  .option('--dry-run', 'Generate and validate a patch without applying it', false)
  .option('--no-pr', 'Skip branch push and GitHub PR creation')
  .option('--base <branch>', 'Base branch for PR')
  .option('--branch <branch>', 'Branch name for PR')
  .option('--provider <provider>', 'AI provider: openai, anthropic, or ollama', 'openai')
  .option('--model <model>', 'Model override')
  .option('--allow-lockfile', 'Allow lockfile edits', false)
  .option('--demo', 'Use polished terminal output and deterministic fixture patching', false)
  .action(
    async (options: {
      repo: string;
      logFile: string;
      testCommand: string;
      maxRetries: number;
      dryRun: boolean;
      pr: boolean;
      base?: string;
      branch?: string;
      provider: 'openai' | 'anthropic' | 'ollama';
      model?: string;
      allowLockfile: boolean;
      demo: boolean;
    }) => {
      const repoPath = path.resolve(options.repo);
      const result = await autofixTool.execute({
        repoPath,
        logFile: path.resolve(options.logFile),
        testCommand: options.testCommand,
        maxRetries: options.maxRetries,
        dryRun: options.dryRun,
        provider: options.demo ? 'demo' : options.provider,
        model: options.model,
        allowLockfile: options.allowLockfile
      });

      if (result.status === 'fixed' && options.pr) {
        const github = requireGitHubConfig(loadConfig());
        const pr = await createPrFromLocalChanges({
          repoPath,
          token: github.token,
          title: `DevLoop AI: ${result.diagnosis.summary}`,
          body: result.prBody ?? 'Automated CI fix generated by DevLoop AI.',
          base: options.base,
          branch: options.branch
        });
        result.prUrl = pr.url;
      }

      console.log(options.demo ? formatDemoAutoFixResult(result) : JSON.stringify(result, null, 2));
      if (result.status !== 'fixed' && result.status !== 'dry-run') {
        process.exitCode = 1;
      }
    }
  );

program
  .command('security-autofix')
  .description('Read SARIF security alerts, generate safe minimal patches, run tests, and optionally open PRs')
  .requiredOption('--sarif <path>', 'Path to a SARIF 2.1.0 file')
  .requiredOption('--repo <path>', 'Repository path')
  .option('--rule-id <id>', 'Only fix alerts for a specific SARIF rule id')
  .option('--alert-index <number>', 'Only fix the alert at this zero-based index', parseZeroBasedInteger)
  .option('--severity <level>', 'Only fix alerts at this SARIF severity level')
  .option('--dry-run', 'Generate and validate patches without applying them', false)
  .option('--max-alerts <number>', 'Maximum number of alerts to process', parseInteger, 1)
  .option('--one-pr-per-alert', 'Create one pull request per alert when PR creation is configured', false)
  .option('--test-command <command>', 'Command used to validate the security fix')
  .option('--max-retries <number>', 'Maximum patch attempts per alert', parseInteger, 1)
  .action(
    async (options: {
      sarif: string;
      repo: string;
      ruleId?: string;
      alertIndex?: number;
      severity?: string;
      dryRun: boolean;
      maxAlerts: number;
      onePrPerAlert: boolean;
      testCommand?: string;
      maxRetries: number;
    }) => {
      const config = loadConfig();
      const token = config.github.token || undefined;
      const result = await runSecurityAutofix({
        repoPath: path.resolve(options.repo),
        sarifPath: path.resolve(options.sarif),
        ruleId: options.ruleId,
        alertIndex: options.alertIndex,
        severity: options.severity,
        dryRun: options.dryRun,
        maxAlerts: options.maxAlerts,
        onePrPerAlert: options.onePrPerAlert,
        testCommand: options.testCommand,
        maxRetries: options.maxRetries,
        githubToken: options.dryRun ? undefined : token
      });

      console.log(JSON.stringify(result, null, 2));
      if (result.results.some((item) => item.status === 'failed' || item.status === 'unsafe')) {
        process.exitCode = 1;
      }
    }
  );

const benchCommand = program
  .command('bench')
  .description('Run FixBench benchmark suites for DevLoop CI autofix');

benchCommand
  .command('list')
  .description('List FixBench benchmark cases')
  .option('--suite <path>', 'Benchmark suite path', defaultSuitePath())
  .action(async (options: { suite: string }) => {
    const suite = await loadBenchmarkSuite(path.resolve(options.suite));
    console.log(`${suite.name} ${suite.version}`);
    for (const testCase of suite.cases) {
      console.log(
        `${testCase.id}\t${testCase.language}\t${testCase.category}\t${testCase.difficulty}\t${testCase.testCommand}`
      );
    }
  });

benchCommand
  .command('run')
  .description('Run FixBench and write JSON, Markdown, and HTML reports')
  .option('--suite <path>', 'Benchmark suite path', defaultSuitePath())
  .option('--model <model>', 'Model override for model-backed providers')
  .option('--provider <provider>', 'Provider: fixture, openai, anthropic, or ollama', 'fixture')
  .option('--max-retries <number>', 'Maximum autofix attempts per case', parseInteger, 3)
  .option('--output <path>', 'Benchmark output directory', 'benchmark-results')
  .option('--format <format>', 'Primary report format: json, markdown, or html', 'markdown')
  .option('--concurrency <number>', 'Number of cases to run concurrently', parseInteger, 1)
  .option('--keep-workdir', 'Keep per-case temporary work directories for debugging', false)
  .option('--case <id>', 'Run only a selected case id; repeat for multiple cases', collectValues, [])
  .action(
    async (options: {
      suite: string;
      model?: string;
      provider: string;
      maxRetries: number;
      output: string;
      format: 'json' | 'markdown' | 'html';
      concurrency: number;
      keepWorkdir: boolean;
      case: string[];
    }) => {
      const report = await runBenchmarkSuite({
        suitePath: path.resolve(options.suite),
        outputPath: path.resolve(options.output),
        provider: options.provider,
        model: options.model,
        maxRetries: options.maxRetries,
        concurrency: options.concurrency,
        keepWorkdir: options.keepWorkdir,
        format: options.format,
        caseIds: options.case
      });

      console.log(`FixBench completed: ${report.summary.solvedCases}/${report.summary.totalCases} solved`);
      console.log(`Pass@1: ${(report.summary.passAt1 * 100).toFixed(1)}%`);
      console.log(`Pass@3: ${(report.summary.passAt3 * 100).toFixed(1)}%`);
      console.log(`Reports: ${path.resolve(options.output)}`);
    }
  );

benchCommand
  .command('report')
  .description('Regenerate FixBench Markdown and HTML reports from results.json')
  .option('--results <path>', 'Path to benchmark results.json', path.join('benchmark-results', 'results.json'))
  .option('--output <path>', 'Output directory for regenerated reports')
  .action(async (options: { results: string; output?: string }) => {
    const report = await regenerateBenchmarkReports({
      resultsPath: path.resolve(options.results),
      outputPath: options.output ? path.resolve(options.output) : undefined
    });
    console.log(`Regenerated FixBench reports for ${report.summary.totalCases} cases.`);
  });

const appCommand = program
  .command('app')
  .description('Run DevLoop as a GitHub App webhook service');

appCommand
  .command('serve')
  .description('Start the DevLoop GitHub App webhook server')
  .option('--port <number>', 'Webhook server port', parseInteger)
  .option('--db <path>', 'SQLite database path for jobs and deliveries')
  .option('--allow-local-runner', 'Allow local runner fallback when Docker is unavailable', false)
  .option('--allow-network', 'Allow sandbox network access for test commands', false)
  .action(
    async (options: {
      port?: number;
      db?: string;
      allowLocalRunner: boolean;
      allowNetwork: boolean;
    }) => {
      if (options.allowLocalRunner) {
        process.env.DEVLOOP_ALLOW_LOCAL_RUNNER = 'true';
      }
      if (options.allowNetwork) {
        process.env.DEVLOOP_ALLOW_NETWORK = 'true';
      }

      const server = await startAppServer({
        port: options.port,
        databasePath: options.db ? path.resolve(options.db) : undefined
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      console.log(`DevLoop GitHub App server listening on http://127.0.0.1:${port}`);
      console.log('Webhook endpoint: /webhooks/github');
      await waitForShutdown(server);
    }
  );

program
  .command('init')
  .argument('<repo>', 'GitHub repository URL, for example https://github.com/owner/repo.git')
  .description('Clone a GitHub repository into the local DevLoop workspace')
  .action(async (repo: string) => {
    const { state } = await initRepository(repo, process.cwd());
    console.log(`Initialized DevLoop workspace`);
    console.log(`Repository: ${state.repoUrl}`);
    console.log(`Local path: ${state.repoPath}`);
  });

program
  .command('analyze')
  .description('Analyze the initialized repository with an OpenAI-compatible LLM')
  .action(async () => {
    const config = loadConfig();
    const openai = requireOpenAiConfig(config);
    const state = await loadState(process.cwd());
    const paths = workspacePathsForState(process.cwd(), state);
    const client = new LlmClient({
      apiKey: openai.apiKey,
      baseUrl: openai.baseUrl,
      model: openai.model
    });

    const analysis = await analyzeRepository(state.repoPath, paths.analysisPath, client);
    await saveState(paths.statePath, { ...state, analysisPath: paths.analysisPath });
    printAnalysis(analysis, paths.analysisPath);
  });

program
  .command('fix')
  .description('Generate and apply the recommended AI code fix')
  .action(async () => {
    const config = loadConfig();
    const openai = requireOpenAiConfig(config);
    const state = await loadState(process.cwd());
    const paths = workspacePathsForState(process.cwd(), state);
    const analysisPath = state.analysisPath ?? paths.analysisPath;
    const analysis = JSON.parse(await readFile(analysisPath, 'utf8')) as AnalysisResult;
    const client = new LlmClient({
      apiKey: openai.apiKey,
      baseUrl: openai.baseUrl,
      model: openai.model
    });

    const fix = await generateAndApplyFix(state.repoPath, analysis, client);
    await writeFile(paths.fixPath, `${JSON.stringify(fix, null, 2)}\n`, 'utf8');
    await saveState(paths.statePath, { ...state, fixPath: paths.fixPath });

    console.log(`Applied fix: ${fix.summary}`);
    console.log(`Patch: ${fix.patchDescription}`);
    console.log(`Changed files: ${fix.changedFiles.join(', ')}`);
  });

program
  .command('pr')
  .description('Commit local fixes, push a branch, and open a GitHub pull request')
  .action(async () => {
    const config = loadConfig();
    const github = requireGitHubConfig(config);
    const state = await loadState(process.cwd());
    const paths = workspacePathsForState(process.cwd(), state);
    const fix = JSON.parse(await readFile(state.fixPath ?? paths.fixPath, 'utf8')) as {
      summary?: string;
      patchDescription?: string;
      changedFiles?: string[];
    };

    const title = `DevLoop AI: ${fix.summary ?? 'automated fix'}`;
    const body = [
      '## Summary',
      fix.patchDescription ?? 'Automated code fix generated by DevLoop AI.',
      '',
      '## Changed Files',
      ...(fix.changedFiles ?? []).map((file) => `- ${file}`),
      '',
      'Generated by DevLoop AI.'
    ].join('\n');

    const pr = await createPrFromLocalChanges({
      repoPath: state.repoPath,
      token: github.token,
      title,
      body
    });

    console.log(`Created PR #${pr.number}: ${pr.url}`);
    console.log(`Branch: ${pr.branch}`);
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`devloop error: ${message}`);
  process.exitCode = 1;
});

function printAnalysis(analysis: AnalysisResult, analysisPath: string): void {
  console.log('Architecture Summary');
  console.log(analysis.architectureSummary);
  console.log('');
  console.log('Bugs');
  for (const bug of analysis.bugs) {
    console.log(`- [${bug.severity}] ${bug.title} (${bug.file})`);
  }
  console.log('');
  console.log('Risky Files');
  for (const file of analysis.riskyFiles) {
    console.log(`- ${file.file}: ${file.reason}`);
  }
  console.log('');
  console.log(`Recommended Fix: ${analysis.recommendedFix.title}`);
  console.log(`File: ${analysis.recommendedFix.file}`);
  console.log(`Saved analysis: ${path.resolve(analysisPath)}`);
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }

  return parsed;
}

function parseZeroBasedInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected a zero-based integer, got: ${value}`);
  }

  return parsed;
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseEvidenceFormat(value: string): EvidenceExportFormat {
  if (value === 'json' || value === 'zip' || value === 'markdown') {
    return value;
  }
  throw new Error(`Expected evidence format json, zip, or markdown, got: ${value}`);
}

function parseFirewallBenchFormat(value: string): FirewallBenchFormat {
  if (value === 'json' || value === 'markdown' || value === 'html') {
    return value;
  }
  throw new Error(`Expected FirewallBench format json, markdown, or html, got: ${value}`);
}

function parseOrgFirewallMode(value: string): OrgFirewallMode {
  if (value === 'strict' || value === 'default' || value === 'permissive') {
    return value;
  }
  throw new Error(`Expected org firewall mode strict, default, or permissive, got: ${value}`);
}

function parseSupportedAgent(value: string): SupportedAgent {
  if (value === 'codex' || value === 'claude-code' || value === 'cursor-agent' || value === 'custom') {
    return value;
  }
  throw new Error(`Unsupported agent adapter: ${value}`);
}

function parseAgentSandbox(value: string): AgentSandboxMode {
  if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') {
    return value;
  }
  throw new Error(`Expected agent sandbox read-only, workspace-write, or danger-full-access, got: ${value}`);
}

function defaultSuitePath(): string {
  return path.resolve('benchmarks', 'fixbench');
}

function defaultFirewallBenchSuitePath(): string {
  return path.resolve('benchmarks', 'firewallbench');
}

function parseInputSource(value: string): InputSource {
  const aliases: Record<string, InputSource> = {
    'pr-comment': 'pull_request_comment',
    'pr-body': 'pull_request_body',
    'pr-title': 'pull_request_title',
    'issue-comment': 'issue_comment',
    'issue-body': 'issue_body',
    'ci-log': 'ci_log',
    'test-output': 'test_output',
    'repo-file': 'repository_file',
    'user-prompt': 'user_prompt',
    'system-config': 'system_config'
  };
  const normalized = value.replace(/_/g, '-');
  const source = aliases[normalized] ?? (value as InputSource);
  const allowed: InputSource[] = [
    'issue_body',
    'issue_comment',
    'pull_request_title',
    'pull_request_body',
    'pull_request_comment',
    'commit_message',
    'branch_name',
    'ci_log',
    'test_output',
    'repository_file',
    'user_prompt',
    'system_config'
  ];
  if (!allowed.includes(source)) {
    throw new Error(`Unknown firewall input source: ${value}`);
  }
  return source;
}

function printFirewallResult(result: FirewallResult): void {
  console.log(JSON.stringify(result, null, 2));
  if (result.decision === 'block' || result.riskLevel === 'critical') {
    process.exitCode = 1;
  }
}

async function createFirewallEvidence(
  repoPath: string,
  type: string,
  result: FirewallResult
): Promise<{ runId: string; path: string }> {
  const evidence = await createEvidenceBundle({
    repoPath,
    trigger: { type },
    model: {
      provider: 'deterministic',
      model: 'agent-firewall'
    },
    sandbox: {
      runner: 'local',
      network: 'disabled',
      secretsMounted: false,
      timeoutSeconds: 0,
      user: process.env.USERNAME ?? process.env.USER ?? 'unknown'
    },
    diagnosis: {
      summary: `Agent Firewall ${result.decision}: ${result.findings.length} finding(s)`,
      confidence: 1,
      likelyFiles: []
    },
    patch: '',
    testBeforeLog: JSON.stringify({ findings: result.findings }, null, 2),
    testAfterLog: '',
    validationCommands: [],
    firewall: {
      decision: result.decision,
      riskLevel: result.riskLevel,
      findingsCount: result.findings.length
    },
    metadata: {
      score: result.score
    }
  });
  return { runId: evidence.runId, path: evidence.path };
}

async function loadOrgScan(configPath: string): Promise<{
  config: DevLoopOrgConfig;
  client: OrgGitHubClient;
  report: OrgScanReport;
}> {
  const config = await loadOrgConfig(configPath);
  const github = requireGitHubConfig(loadConfig());
  const client = new GitHubOrgClient({
    organization: config.organization,
    token: github.token
  });
  return {
    config,
    client,
    report: await scanOrganization({ client, config })
  };
}

function formatOrgSummary(report: OrgScanReport): string {
  return [
    `Organization: ${report.organization}`,
    `Repositories: ${report.summary.totalRepos}`,
    `Enabled: ${report.summary.reposEnabled}`,
    `Dry-run mode: ${report.summary.reposDryRun}`,
    `PR mode: ${report.summary.reposPrMode}`,
    `Recent DevLoop jobs: ${report.summary.recentJobs}`,
    `Success rate: ${formatPercent(report.summary.successRate)}`,
    `Blocked firewall events: ${report.summary.blockedFirewallEvents}`,
    `Security autofix count: ${report.summary.securityAutofixCount}`
  ].join('\n');
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createRolloutPullRequests(client: OrgGitHubClient, plan: RolloutPlan): Promise<void> {
  for (const repo of plan.repositories) {
    if (repo.action !== 'create-pr' || Object.keys(repo.files).length === 0) {
      continue;
    }
    const pr = await client.createPullRequest({
      repo: repo.repo,
      title: repo.title,
      branch: repo.branch,
      base: repo.base,
      body: createOrgRolloutPrBody(repo.repo, repo.files, repo.warnings),
      files: repo.files
    });
    repo.prUrl = pr.url;
  }
}

async function createPolicySyncPullRequests(
  client: OrgGitHubClient,
  plan: PolicySyncPlan,
  report: OrgScanReport
): Promise<void> {
  for (const repo of plan.repositories) {
    if (!repo.changed) {
      continue;
    }
    const scan = report.repositories.find((item) => item.repo === repo.repo);
    const pr = await client.createPullRequest({
      repo: repo.repo,
      title: 'chore: sync DevLoop policy',
      branch: 'devloop/policy-sync',
      base: scan?.defaultBranch ?? 'main',
      body: [
        '## Summary',
        'Sync shared DevLoop firewall policy for organization fleet mode.',
        '',
        '## Safety',
        '- Generated by DevLoop org policy sync.',
        '- Human review required before merge.'
      ].join('\n'),
      files: {
        [repo.path]: repo.desired
      }
    });
    repo.action = 'create-pr';
    repo.prUrl = pr.url;
  }
}

function createOrgRolloutPrBody(repo: string, files: Record<string, string>, warnings: string[]): string {
  return [
    '## Summary',
    `Enable DevLoop AI organization fleet configuration for ${repo}.`,
    '',
    '## Files',
    ...Object.keys(files).map((file) => `- ${file}`),
    '',
    '## Safety',
    '- Generated by DevLoop org rollout.',
    '- Default rollout keeps repositories in dry-run mode unless PR mode was explicitly confirmed.',
    '- Human review required before merge.',
    ...(warnings.length > 0 ? ['', '## Warnings', ...warnings.map((warning) => `- ${warning}`)] : [])
  ].join('\n');
}

async function waitForShutdown(server: Awaited<ReturnType<typeof startAppServer>>): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = () => {
      server.close(() => resolve());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
