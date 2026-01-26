/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
  };
});

import { Storage } from './storage.js';
import { CODEFLY_DIR } from '../utils/paths.js';

describe('Storage – getGlobalSettingsPath', () => {
  it('returns path to ~/.codefly/settings.json', () => {
    const expected = path.join(os.homedir(), CODEFLY_DIR, 'settings.json');
    expect(Storage.getGlobalSettingsPath()).toBe(expected);
  });
});

describe('Storage – additional helpers', () => {
  const projectRoot = '/tmp/project';
  const storage = new Storage(projectRoot);

  it('getWorkspaceSettingsPath returns project/.codefly/settings.json', () => {
    const expected = path.join(projectRoot, CODEFLY_DIR, 'settings.json');
    expect(storage.getWorkspaceSettingsPath()).toBe(expected);
  });

  it('getUserCommandsDir returns ~/.codefly/commands', () => {
    const expected = path.join(os.homedir(), CODEFLY_DIR, 'commands');
    expect(Storage.getUserCommandsDir()).toBe(expected);
  });

  it('getProjectCommandsDir returns project/.codefly/commands', () => {
    const expected = path.join(projectRoot, CODEFLY_DIR, 'commands');
    expect(storage.getProjectCommandsDir()).toBe(expected);
  });

  it('getUserSkillsDir returns ~/.codefly/skills', () => {
    const expected = path.join(os.homedir(), CODEFLY_DIR, 'skills');
    expect(Storage.getUserSkillsDir()).toBe(expected);
  });

  it('getProjectSkillsDir returns project/.codefly/skills', () => {
    const expected = path.join(projectRoot, CODEFLY_DIR, 'skills');
    expect(storage.getProjectSkillsDir()).toBe(expected);
  });

  it('getUserAgentsDir returns ~/.codefly/agents', () => {
    const expected = path.join(os.homedir(), CODEFLY_DIR, 'agents');
    expect(Storage.getUserAgentsDir()).toBe(expected);
  });

  it('getProjectAgentsDir returns project/.codefly/agents', () => {
    const expected = path.join(projectRoot, CODEFLY_DIR, 'agents');
    expect(storage.getProjectAgentsDir()).toBe(expected);
  });

  it('getMcpOAuthTokensPath returns ~/.codefly/mcp-oauth-tokens.json', () => {
    const expected = path.join(
      os.homedir(),
      CODEFLY_DIR,
      'mcp-oauth-tokens.json',
    );
    expect(Storage.getMcpOAuthTokensPath()).toBe(expected);
  });

  it('getGlobalBinDir returns ~/.codefly/tmp/bin', () => {
    const expected = path.join(os.homedir(), CODEFLY_DIR, 'tmp', 'bin');
    expect(Storage.getGlobalBinDir()).toBe(expected);
  });
});
