import { describe, expect, test } from 'vitest';
import {
  parseGitHubRemote,
  repoSlugFromUrl,
  resolveWorkspacePaths
} from './repository.js';

describe('repository helpers', () => {
  test('creates a stable local slug from GitHub URLs', () => {
    expect(repoSlugFromUrl('https://github.com/acme/widgets.git')).toBe('acme__widgets');
    expect(repoSlugFromUrl('git@github.com:acme/widgets.git')).toBe('acme__widgets');
  });

  test('parses GitHub remote owner and repo', () => {
    expect(parseGitHubRemote('https://github.com/acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets'
    });
    expect(parseGitHubRemote('git@github.com:acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets'
    });
    expect(parseGitHubRemote('https://x-access-token:secret@github.com/acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets'
    });
  });

  test('keeps DevLoop state inside the current working directory', () => {
    const paths = resolveWorkspacePaths('C:/work/devloop', 'acme__widgets');

    expect(paths.root).toBe('C:/work/devloop/.devloop');
    expect(paths.repoPath).toBe('C:/work/devloop/.devloop/repos/acme__widgets');
    expect(paths.statePath).toBe('C:/work/devloop/.devloop/state.json');
  });
});
