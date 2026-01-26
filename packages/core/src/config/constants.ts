/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FileFilteringOptions {
  respectGitIgnore: boolean;
  respectCodeflyIgnore: boolean;
  maxFileCount?: number;
  searchTimeout?: number;
}

// For memory files
export const DEFAULT_MEMORY_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: false,
  respectCodeflyIgnore: true,
  maxFileCount: 20000,
  searchTimeout: 5000,
};

// For all other files
export const DEFAULT_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: true,
  respectCodeflyIgnore: true,
  maxFileCount: 20000,
  searchTimeout: 5000,
};
