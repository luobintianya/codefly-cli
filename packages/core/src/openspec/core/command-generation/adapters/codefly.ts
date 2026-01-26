/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import type { CommandContent, ToolCommandAdapter } from '../types.js';

/**
 * Codefly adapter for command generation.
 * File path: .codefly/commands/opsx/<id>.toml
 * Format: TOML with description and prompt fields
 */
export const codeflyAdapter: ToolCommandAdapter = {
  toolId: 'codefly',

  getFilePath(commandId: string): string {
    return path.join('.codefly', 'commands', 'opsx', `${commandId}.toml`);
  },

  formatFile(content: CommandContent): string {
    return `description = "${content.description}"

prompt = """
${content.body}
"""
`;
  },
};
