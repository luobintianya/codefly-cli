/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { runOpenspec } from '@codeflyai/codefly-core';
import type { CommandModule } from 'yargs';

export const openspecCommand: CommandModule = {
  command: 'openspec [args..]',
  describe: 'Spec-driven development tools',
  builder: (yargs) => yargs.help(false).version(false).strict(false),
  handler: async () => {
    // Find the index of 'openspec' in process.argv to properly slice
    // process.argv is usually [node, script, ...args]
    // Example: ['node', 'codefly', 'openspec', 'init']
    const openspecIndex = process.argv.indexOf('openspec');
    const args =
      openspecIndex !== -1
        ? process.argv.slice(openspecIndex + 1)
        : process.argv.slice(2);

    await runOpenspec(args);
    process.exit(process.exitCode ?? 0);
  },
};
