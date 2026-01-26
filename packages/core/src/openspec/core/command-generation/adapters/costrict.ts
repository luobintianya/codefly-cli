/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import type { CommandContent, ToolCommandAdapter } from '../types.js';

/**
 * CoStrict adapter for command generation.
 * File path: .cospec/openspec/commands/opsx-<id>.md
 * Frontmatter: description, argument-hint
 */
export const costrictAdapter: ToolCommandAdapter = {
  toolId: 'costrict',

  getFilePath(commandId: string): string {
    return path.join('.cospec', 'openspec', 'commands', `opsx-${commandId}.md`);
  },

  formatFile(content: CommandContent): string {
    return `---
description: "${content.description}"
argument-hint: command arguments
---

${content.body}
`;
  },
};
