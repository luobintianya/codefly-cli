/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  CommandContent,
  ToolCommandAdapter,
  GeneratedCommand,
} from './types.js';

// Registry
export { CommandAdapterRegistry } from './registry.js';

// Generator functions
export { generateCommand, generateCommands } from './generator.js';

// Adapters (for direct access if needed)
export {
  claudeAdapter,
  cursorAdapter,
  windsurfAdapter,
} from './adapters/index.js';
