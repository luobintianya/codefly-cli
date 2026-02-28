/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeflyIgnoreParser } from './codeflyIgnoreParser.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('CodeflyIgnoreParser', () => {
  let projectRoot: string;

  async function createTestFile(filePath: string, content = '') {
    const fullPath = path.join(projectRoot, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'codeflyignore-test-'),
    );
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('when .codeflyignore exists', () => {
    beforeEach(async () => {
      await createTestFile(
        '.codeflyignore',
        'ignored.txt\n# A comment\n/ignored_dir/\n',
      );
      await createTestFile('ignored.txt', 'ignored');
      await createTestFile('not_ignored.txt', 'not ignored');
      await createTestFile(
        path.join('ignored_dir', 'file.txt'),
        'in ignored dir',
      );
      await createTestFile(
        path.join('subdir', 'not_ignored.txt'),
        'not ignored',
      );
    });

    it('should ignore files specified in .codeflyignore', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.getPatterns()).toEqual(['ignored.txt', '/ignored_dir/']);
      expect(parser.isIgnored('ignored.txt')).toBe(true);
      expect(parser.isIgnored('not_ignored.txt')).toBe(false);
      expect(parser.isIgnored(path.join('ignored_dir', 'file.txt'))).toBe(true);
      expect(parser.isIgnored(path.join('subdir', 'not_ignored.txt'))).toBe(
        false,
      );
    });

    it('should return ignore file path when patterns exist', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.getIgnoreFilePath()).toBe(
        path.join(projectRoot, '.codeflyignore'),
      );
    });

    it('should return true for hasPatterns when patterns exist', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.hasPatterns()).toBe(true);
    });

    it('should return false for hasPatterns when .codeflyignore is deleted', async () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      await fs.rm(path.join(projectRoot, '.codeflyignore'));
      expect(parser.hasPatterns()).toBe(false);
      expect(parser.getIgnoreFilePath()).toBeNull();
    });
  });

  describe('when .codeflyignore does not exist', () => {
    it('should not load any patterns and not ignore any files', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.getPatterns()).toEqual([]);
      expect(parser.isIgnored('any_file.txt')).toBe(false);
    });

    it('should return null for getIgnoreFilePath when no patterns exist', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.getIgnoreFilePath()).toBeNull();
    });

    it('should return false for hasPatterns when no patterns exist', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.hasPatterns()).toBe(false);
    });
  });

  describe('when .codeflyignore is empty', () => {
    beforeEach(async () => {
      await createTestFile('.codeflyignore', '');
    });

    it('should return null for getIgnoreFilePath', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.getIgnoreFilePath()).toBeNull();
    });

    it('should return false for hasPatterns', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.hasPatterns()).toBe(false);
    });
  });

  describe('when .codeflyignore only has comments', () => {
    beforeEach(async () => {
      await createTestFile(
        '.codeflyignore',
        '# This is a comment\n# Another comment\n',
      );
    });

    it('should return null for getIgnoreFilePath', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.getIgnoreFilePath()).toBeNull();
    });

    it('should return false for hasPatterns', () => {
      const parser = new CodeflyIgnoreParser(projectRoot);
      expect(parser.hasPatterns()).toBe(false);
    });
  });
});
