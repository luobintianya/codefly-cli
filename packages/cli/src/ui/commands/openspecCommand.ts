/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import { parse } from 'shell-quote';
import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';

import { coreEvents } from '@codeflyai/codefly-core';

const executeOpenspec = async (context: CommandContext, args: string[]) => {
  const { ui } = context;

  ui.addItem(
    {
      type: MessageType.INFO,
      text: `Running openspec ${args.join(' ')}...`,
    },
    Date.now(),
  );

  return new Promise<void>((resolve) => {
    // Use the current node executable and script path to run the subcommand
    // This ensures we run the same bundle/script version
    const child = spawn(
      process.argv[0],
      [process.argv[1], 'openspec', ...args],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: 'false' },
      },
    );

    let stdoutBuffer = '';
    child.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      // The last part might be incomplete
      stdoutBuffer = lines.pop() || '';

      lines.forEach((line) => {
        // Also log to console for debugging purposes, but this goes to Debug Console
        // eslint-disable-next-line no-console
        console.log(line);

        // Display in UI
        if (line.trim()) {
          ui.addItem(
            {
              type: MessageType.INFO,
              text: line,
            },
            Date.now(),
          );
        }
      });
    });

    let stderrBuffer = '';
    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';

      lines.forEach((line) => {
        // eslint-disable-next-line no-console
        console.error(line);

        if (line.trim()) {
          ui.addItem(
            {
              // Some tools print non-errors to stderr, but we'll treat as info or error?
              // Let's use INFO for stderr unless it's clearly an error, but openspec usually uses stderr for logging too.
              // However, usually stderr is warnings/errors.
              type: MessageType.INFO, // keeping as info to avoid alarming red text for mundane logs if any
              text: line,
            },
            Date.now(),
          );
        }
      });
    });

    child.on('close', (code) => {
      // Flush remaining buffers
      if (stdoutBuffer.trim()) {
        // eslint-disable-next-line no-console
        console.log(stdoutBuffer);
        ui.addItem({ type: MessageType.INFO, text: stdoutBuffer }, Date.now());
      }
      if (stderrBuffer.trim()) {
        // eslint-disable-next-line no-console
        console.error(stderrBuffer);
        ui.addItem({ type: MessageType.INFO, text: stderrBuffer }, Date.now());
      }

      if (code !== 0) {
        ui.addItem(
          {
            type: MessageType.ERROR,
            text: `openspec exited with code ${code}`,
          },
          Date.now(),
        );
      } else {
        // Trigger command reload as openspec might have generated new commands
        coreEvents.emitCommandsRefreshed();
      }
      resolve();
    });

    child.on('error', (err) => {
      ui.addItem(
        {
          type: MessageType.ERROR,
          text: `Failed to spawn openspec: ${err.message}`,
        },
        Date.now(),
      );
      resolve();
    });
  });
};

const createSubCommandAction =
  (commandName: string) =>
  async (context: CommandContext, argsString: string) => {
    const args = parse(argsString).map((arg) => String(arg));
    return executeOpenspec(context, [commandName, ...args]);
  };

export const openspecCommand: SlashCommand = {
  name: 'openspec',
  altNames: ['op'],
  description: 'AI-native system for spec-driven development',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  subCommands: [
    {
      name: 'init',
      description: 'Initialize OpenSpec in your project',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('init'),
    },
    {
      name: 'update',
      description: 'Update OpenSpec instruction files',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('update'),
    },
    {
      name: 'list',
      description:
        'List items (changes by default). Use --specs to list specs.',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('list'),
    },
    {
      name: 'change',
      description: 'Manage OpenSpec change proposals',
      kind: CommandKind.BUILT_IN,
      autoExecute: false,
      action: createSubCommandAction('change'),
    },
    {
      name: 'archive',
      description: 'Archive a completed change and update main specs',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('archive'),
    },
    {
      name: 'spec',
      description: 'Manage and view OpenSpec specifications',
      kind: CommandKind.BUILT_IN,
      autoExecute: false,
      action: createSubCommandAction('spec'),
    },
    {
      name: 'config',
      description: 'View and modify global OpenSpec configuration',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('config'),
    },
    {
      name: 'schema',
      description: 'Manage workflow schemas [experimental]',
      kind: CommandKind.BUILT_IN,
      autoExecute: false,
      action: createSubCommandAction('schema'),
    },
    {
      name: 'validate',
      description: 'Validate changes and specs',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('validate'),
    },
    {
      name: 'show',
      description: 'Show a change or spec',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('show'),
    },
    {
      name: 'completion',
      description: 'Manage shell completions for OpenSpec CLI',
      kind: CommandKind.BUILT_IN,
      autoExecute: false,
      action: createSubCommandAction('completion'),
    },
    {
      name: 'status',
      description: 'Display artifact completion status for a change',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('status'),
    },
    {
      name: 'instructions',
      description:
        'Output enriched instructions for creating an artifact or applying tasks',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('instructions'),
    },
    {
      name: 'templates',
      description: 'Show resolved template paths for all artifacts in a schema',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('templates'),
    },
    {
      name: 'schemas',
      description: 'List available workflow schemas with descriptions',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('schemas'),
    },
    {
      name: 'new',
      description: 'Create new items',
      kind: CommandKind.BUILT_IN,
      autoExecute: false,
      action: createSubCommandAction('new'),
    },
    {
      name: 'help',
      description: 'display help for command',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('help'),
    },
    {
      name: 'view',
      description: 'Display an interactive dashboard of specs and changes',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('view'),
    },
    {
      name: 'feedback',
      description: 'Submit feedback about OpenSpec',
      kind: CommandKind.BUILT_IN,
      autoExecute: true,
      action: createSubCommandAction('feedback'),
    },
  ],
  action: async (context, argsString) => {
    const args = parse(argsString).map((arg) => String(arg));
    return executeOpenspec(context, args);
  },
};
