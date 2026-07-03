export interface GitHubActionsContext {
  repository?: string;
  runId?: string;
  sha?: string;
  refName?: string;
  token?: string;
  runUrl?: string;
}

export function readGitHubActionsContext(env: NodeJS.ProcessEnv = process.env): GitHubActionsContext {
  const repository = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  return {
    repository,
    runId,
    sha: env.GITHUB_SHA,
    refName: env.GITHUB_REF_NAME,
    token: env.GITHUB_TOKEN,
    runUrl: repository && runId ? `https://github.com/${repository}/actions/runs/${runId}` : undefined
  };
}

export async function fetchWorkflowRunLogs(context: GitHubActionsContext): Promise<string | undefined> {
  if (!context.repository || !context.runId || !context.token) {
    return undefined;
  }

  const response = await fetch(
    `https://api.github.com/repos/${context.repository}/actions/runs/${context.runId}/logs`,
    {
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'devloop-ai'
      }
    }
  );

  if (!response.ok) {
    return undefined;
  }

  return await response.text();
}
