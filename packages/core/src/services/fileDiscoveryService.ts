/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import type { CodeflyIgnoreFilter } from '../utils/codeflyIgnoreParser.js';
import { GitIgnoreParser } from '../utils/gitIgnoreParser.js';
import { CodeflyIgnoreParser } from '../utils/codeflyIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import fs from 'node:fs';
import * as path from 'node:path';

import {
  IgnoreFileParser,
  type IgnoreFileFilter,
} from '../utils/ignoreFileParser.js';

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectCodeflyIgnore?: boolean;
  customIgnoreFilePaths?: string[];
}

export interface FilterReport {
  filteredPaths: string[];
  ignoredCount: number;
}

export class FileDiscoveryService {
  private defaultFilterFileOptions: FilterFilesOptions = {
    respectGitIgnore: true,
    respectCodeflyIgnore: true,
  };
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private codeflyIgnoreFilter: CodeflyIgnoreFilter | null = null;
  private customIgnoreFilter: IgnoreFileFilter | null = null;
  private combinedIgnoreFilter: GitIgnoreFilter | IgnoreFileFilter | null =
    null;
  private projectRoot: string;

  constructor(projectRoot: string, options?: FilterFilesOptions) {
    this.projectRoot = path.resolve(projectRoot);
    this.applyFilterFilesOptions(options);
    if (isGitRepository(this.projectRoot)) {
      this.gitIgnoreFilter = new GitIgnoreParser(this.projectRoot);
    }
    this.codeflyIgnoreFilter = new CodeflyIgnoreParser(this.projectRoot);

    if (this.defaultFilterFileOptions.customIgnoreFilePaths?.length) {
      this.customIgnoreFilter = new IgnoreFileParser(
        this.projectRoot,
        this.defaultFilterFileOptions.customIgnoreFilePaths,
      );
    }

    const customPatterns = this.customIgnoreFilter
      ? this.customIgnoreFilter.getPatterns()
      : [];

    if (this.gitIgnoreFilter) {
      const codeflyPatterns = this.codeflyIgnoreFilter.getPatterns();
      // Create combined parser: .gitignore + .codeflyignore + custom
      this.combinedIgnoreFilter = new GitIgnoreParser(this.projectRoot, [
        ...codeflyPatterns,
        ...customPatterns,
      ]);
    } else {
      // Create combined parser when not git repo
      const codeflyPatterns = this.codeflyIgnoreFilter.getPatterns();
      this.combinedIgnoreFilter = new IgnoreFileParser(
        this.projectRoot,
        [...codeflyPatterns, ...customPatterns],
        true,
      );
    }
  }

  private applyFilterFilesOptions(options?: FilterFilesOptions): void {
    if (!options) return;

    if (options.respectGitIgnore !== undefined) {
      this.defaultFilterFileOptions.respectGitIgnore = options.respectGitIgnore;
    }
    if (options.respectCodeflyIgnore !== undefined) {
      this.defaultFilterFileOptions.respectCodeflyIgnore =
        options.respectCodeflyIgnore;
    }
    if (options.customIgnoreFilePaths) {
      this.defaultFilterFileOptions.customIgnoreFilePaths =
        options.customIgnoreFilePaths;
    }
  }

  /**
   * Filters a list of file paths based on ignore rules
   */
  filterFiles(filePaths: string[], options: FilterFilesOptions = {}): string[] {
    const { respectGitIgnore = true, respectCodeflyIgnore = true } = options;
    return filePaths.filter((filePath) => {
      if (
        respectGitIgnore &&
        respectCodeflyIgnore &&
        this.combinedIgnoreFilter
      ) {
        return !this.combinedIgnoreFilter.isIgnored(filePath);
      }

      // Always respect custom ignore filter if provided
      if (this.customIgnoreFilter?.isIgnored(filePath)) {
        return false;
      }

      if (respectGitIgnore && this.gitIgnoreFilter?.isIgnored(filePath)) {
        return false;
      }
      if (
        respectCodeflyIgnore &&
        this.codeflyIgnoreFilter?.isIgnored(filePath)
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Filters a list of file paths based on git ignore rules and returns a report
   * with counts of ignored files.
   */
  filterFilesWithReport(
    filePaths: string[],
    opts: FilterFilesOptions = {
      respectGitIgnore: true,
      respectCodeflyIgnore: true,
    },
  ): FilterReport {
    const filteredPaths = this.filterFiles(filePaths, opts);
    const ignoredCount = filePaths.length - filteredPaths.length;

    return {
      filteredPaths,
      ignoredCount,
    };
  }

  /**
   * Unified method to check if a file should be ignored based on filtering options
   */
  shouldIgnoreFile(
    filePath: string,
    options: FilterFilesOptions = {},
  ): boolean {
    return this.filterFiles([filePath], options).length === 0;
  }

  /**
   * Returns the list of ignore files being used (e.g. .codeflyignore) excluding .gitignore.
   */
  getIgnoreFilePaths(): string[] {
    const paths: string[] = [];
    if (
      this.codeflyIgnoreFilter &&
      this.defaultFilterFileOptions.respectCodeflyIgnore
    ) {
      const codeflyIgnoreFilePath =
        this.codeflyIgnoreFilter.getIgnoreFilePath();
      if (codeflyIgnoreFilePath) {
        paths.push(codeflyIgnoreFilePath);
      }
    }
    if (this.customIgnoreFilter) {
      paths.push(...this.customIgnoreFilter.getIgnoreFilePaths());
    }
    return paths;
  }

  /**
   * Returns all ignore files including .gitignore if applicable.
   */
  getAllIgnoreFilePaths(): string[] {
    const paths: string[] = [];
    if (
      this.gitIgnoreFilter &&
      this.defaultFilterFileOptions.respectGitIgnore
    ) {
      const gitIgnorePath = path.join(this.projectRoot, '.gitignore');
      if (fs.existsSync(gitIgnorePath)) {
        paths.push(gitIgnorePath);
      }
    }
    return paths.concat(this.getIgnoreFilePaths());
  }
}
