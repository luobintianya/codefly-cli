/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './src/index.js';
export * from './src/core/apiKeyCredentialStorage.js';
export { Storage } from './src/config/storage.js';
export {
  DEFAULT_CODEFLY_MODEL,
  DEFAULT_CODEFLY_MODEL_AUTO,
  DEFAULT_CODEFLY_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_CODEFLY_EMBEDDING_MODEL,
} from './src/config/models.js';
export {
  serializeTerminalToObject,
  type AnsiOutput,
  type AnsiLine,
  type AnsiToken,
} from './src/utils/terminalSerializer.js';
export {
  DEFAULT_TRUNCATE_TOOL_OUTPUT_LINES,
  DEFAULT_TRUNCATE_TOOL_OUTPUT_THRESHOLD,
} from './src/config/config.js';
export { detectIdeFromEnv } from './src/ide/detect-ide.js';
export {
  logExtensionEnable,
  logIdeConnection,
  logExtensionDisable,
} from './src/telemetry/loggers.js';

export {
  IdeConnectionEvent,
  IdeConnectionType,
  ExtensionInstallEvent,
  ExtensionDisableEvent,
  ExtensionEnableEvent,
  ExtensionUninstallEvent,
  ExtensionUpdateEvent,
  ModelSlashCommandEvent,
} from './src/telemetry/types.js';
export { makeFakeConfig } from './src/test-utils/config.js';
export * from './src/utils/pathReader.js';
export { logModelSlashCommand } from './src/telemetry/loggers.js';
export * from './src/utils/paths.js';
export { KeychainTokenStorage } from './src/mcp/token-storage/keychain-token-storage.js';
export * from './src/utils/googleQuotaErrors.js';
export type { GoogleApiError } from './src/utils/googleErrors.js';
export { getCodeAssistServer } from './src/code_assist/codeAssist.js';
export { getExperiments } from './src/code_assist/experiments/experiments.js';
export { ExperimentFlags } from './src/code_assist/experiments/flagNames.js';
export { getErrorStatus, ModelNotFoundError } from './src/utils/httpErrors.js';
export { homedir, tmpdir } from 'node:os';
export * from './src/utils/constants.js';
export * from './src/commands/memory.js';
export * from './src/agents/agentLoader.js';
export * from './src/utils/fileDiffUtils.js';
export * from './src/code_assist/telemetry.js';
export * from './src/utils/errorParsing.js';
