/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SkillManager } from './skillManager.js';
import { Storage } from '../config/storage.js';
import { loadSkillsFromDir } from './skillLoader.js';

vi.mock('./skillLoader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./skillLoader.js')>();
  return {
    ...actual,
    loadSkillsFromDir: vi.fn(actual.loadSkillsFromDir),
  };
});

describe('SkillManager Alias', () => {
  let testRootDir: string;

  beforeEach(async () => {
    testRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'skill-manager-alias-test-'),
    );
  });

  afterEach(async () => {
    await fs.rm(testRootDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should discover skills from .agents/skills directory', async () => {
    const userCodeflyDir = path.join(testRootDir, 'user', '.codefly', 'skills');
    const userAgentDir = path.join(testRootDir, 'user', '.agents', 'skills');
    const projectCodeflyDir = path.join(
      testRootDir,
      'workspace',
      '.codefly',
      'skills',
    );
    const projectAgentDir = path.join(
      testRootDir,
      'workspace',
      '.agents',
      'skills',
    );

    await fs.mkdir(userCodeflyDir, { recursive: true });
    await fs.mkdir(userAgentDir, { recursive: true });
    await fs.mkdir(projectCodeflyDir, { recursive: true });
    await fs.mkdir(projectAgentDir, { recursive: true });

    vi.mocked(loadSkillsFromDir).mockImplementation(async (dir) => {
      if (dir === userCodeflyDir) {
        return [
          {
            name: 'user-codefly',
            description: 'desc',
            location: 'loc',
            body: '',
          },
        ];
      }
      if (dir === userAgentDir) {
        return [
          {
            name: 'user-agent',
            description: 'desc',
            location: 'loc',
            body: '',
          },
        ];
      }
      if (dir === projectCodeflyDir) {
        return [
          {
            name: 'project-codefly',
            description: 'desc',
            location: 'loc',
            body: '',
          },
        ];
      }
      if (dir === projectAgentDir) {
        return [
          {
            name: 'project-agent',
            description: 'desc',
            location: 'loc',
            body: '',
          },
        ];
      }
      return [];
    });

    vi.spyOn(Storage, 'getUserSkillsDir').mockReturnValue(userCodeflyDir);
    vi.spyOn(Storage, 'getUserAgentSkillsDir').mockReturnValue(userAgentDir);

    const storage = new Storage(path.join(testRootDir, 'workspace'));
    vi.spyOn(storage, 'getProjectSkillsDir').mockReturnValue(projectCodeflyDir);
    vi.spyOn(storage, 'getProjectAgentSkillsDir').mockReturnValue(
      projectAgentDir,
    );

    const service = new SkillManager();
    // @ts-expect-error accessing private method for testing
    vi.spyOn(service, 'discoverBuiltinSkills').mockResolvedValue(undefined);

    await service.discoverSkills(storage, [], true);

    const skills = service.getSkills();
    expect(skills).toHaveLength(4);
    const names = skills.map((s) => s.name);
    expect(names).toContain('user-codefly');
    expect(names).toContain('user-agent');
    expect(names).toContain('project-codefly');
    expect(names).toContain('project-agent');
  });

  it('should give .agents precedence over .codefly when in the same tier', async () => {
    const userCodeflyDir = path.join(testRootDir, 'user', '.codefly', 'skills');
    const userAgentDir = path.join(testRootDir, 'user', '.agents', 'skills');

    await fs.mkdir(userCodeflyDir, { recursive: true });
    await fs.mkdir(userAgentDir, { recursive: true });

    vi.mocked(loadSkillsFromDir).mockImplementation(async (dir) => {
      if (dir === userCodeflyDir) {
        return [
          {
            name: 'same-skill',
            description: 'codefly-desc',
            location: 'loc-codefly',
            body: '',
          },
        ];
      }
      if (dir === userAgentDir) {
        return [
          {
            name: 'same-skill',
            description: 'agent-desc',
            location: 'loc-agent',
            body: '',
          },
        ];
      }
      return [];
    });

    vi.spyOn(Storage, 'getUserSkillsDir').mockReturnValue(userCodeflyDir);
    vi.spyOn(Storage, 'getUserAgentSkillsDir').mockReturnValue(userAgentDir);

    const storage = new Storage('/dummy');
    vi.spyOn(storage, 'getProjectSkillsDir').mockReturnValue(
      '/non-existent-codefly',
    );
    vi.spyOn(storage, 'getProjectAgentSkillsDir').mockReturnValue(
      '/non-existent-agent',
    );

    const service = new SkillManager();
    // @ts-expect-error accessing private method for testing
    vi.spyOn(service, 'discoverBuiltinSkills').mockResolvedValue(undefined);

    await service.discoverSkills(storage, [], true);

    const skills = service.getSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].description).toBe('agent-desc');
  });
});
