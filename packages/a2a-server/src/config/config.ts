/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

import {
  type TelemetryTarget,
  AuthType,
  Config,
  FileDiscoveryService,
  ApprovalMode,
  loadServerHierarchicalMemory,
  CODEFLY_DIR,
  DEFAULT_CODEFLY_EMBEDDING_MODEL,
  DEFAULT_CODEFLY_MODEL,
  type ExtensionLoader,
  startupProfiler,
  homedir,
  GitService,
  type ConfigParameters,
  getCodeAssistServer,
  fetchAdminControlsOnce,
  ExperimentFlags,
} from '@codeflyai/codefly-core';

import { logger } from '../utils/logger.js';
import type { Settings } from './settings.js';
import { type AgentSettings, CoderAgentEvent } from '../types.js';

export async function loadConfig(
  settings: Settings,
  extensionLoader: ExtensionLoader,
  taskId: string,
): Promise<Config> {
  const workspaceDir = process.cwd();
  const adcFilePath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];

  const folderTrust =
    settings.folderTrust === true ||
    process.env['CODEFLY_FOLDER_TRUST'] === 'true';

  let checkpointing = process.env['CHECKPOINTING']
    ? process.env['CHECKPOINTING'] === 'true'
    : settings.checkpointing?.enabled;

  if (checkpointing) {
    if (!(await GitService.verifyGitAvailability())) {
      logger.warn(
        '[Config] Checkpointing is enabled but git is not installed. Disabling checkpointing.',
      );
      checkpointing = false;
    }
  }

  const configParams: ConfigParameters = {
    sessionId: taskId,
    model: DEFAULT_CODEFLY_MODEL,
    embeddingModel: DEFAULT_CODEFLY_EMBEDDING_MODEL,
    sandbox: undefined, // Sandbox might not be relevant for a server-side agent
    targetDir: workspaceDir, // Or a specific directory the agent operates on
    debugMode: process.env['DEBUG'] === 'true' || false,
    question: '', // Not used in server mode directly like CLI

    coreTools: settings.coreTools || settings.tools?.core || undefined,
    excludeTools: settings.excludeTools || settings.tools?.exclude || undefined,
    allowedTools: settings.allowedTools || settings.tools?.allowed || undefined,
    showMemoryUsage: settings.showMemoryUsage || false,
    approvalMode:
      process.env['CODEFLY_YOLO_MODE'] === 'true'
        ? ApprovalMode.YOLO
        : ApprovalMode.DEFAULT,
    mcpServers: settings.mcpServers,
    cwd: workspaceDir,
    telemetry: {
      enabled: settings.telemetry?.enabled,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      target: settings.telemetry?.target as TelemetryTarget,
      otlpEndpoint:
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
        settings.telemetry?.otlpEndpoint,
      logPrompts: settings.telemetry?.logPrompts,
    },
    // Git-aware file filtering settings
    fileFiltering: {
      respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
      respectCodeflyIgnore: settings.fileFiltering?.respectCodeflyIgnore,
      enableRecursiveFileSearch:
        settings.fileFiltering?.enableRecursiveFileSearch,
      customIgnoreFilePaths: [
        ...(settings.fileFiltering?.customIgnoreFilePaths || []),
        ...(process.env['CUSTOM_IGNORE_FILE_PATHS']
          ? process.env['CUSTOM_IGNORE_FILE_PATHS'].split(path.delimiter)
          : []),
      ],
    },
    ideMode: false,
    folderTrust,
    trustedFolder: true,
    extensionLoader,
    checkpointing,
    interactive: true,
    enableInteractiveShell: true,
    ptyInfo: 'auto',
  };

  const fileService = new FileDiscoveryService(workspaceDir, {
    respectGitIgnore: configParams?.fileFiltering?.respectGitIgnore,
    respectCodeflyIgnore: configParams?.fileFiltering?.respectCodeflyIgnore,
    customIgnoreFilePaths: configParams?.fileFiltering?.customIgnoreFilePaths,
  });
  const { memoryContent, fileCount, filePaths } =
    await loadServerHierarchicalMemory(
      workspaceDir,
      [workspaceDir],
      false,
      fileService,
      extensionLoader,
      folderTrust,
    );
  configParams.userMemory = memoryContent;
  configParams.codeflyMdFileCount = fileCount;
  configParams.codeflyMdFilePaths = filePaths;
  const initialConfig = new Config({
    ...configParams,
  });

  const codeAssistServer = getCodeAssistServer(initialConfig);

  const adminControlsEnabled =
    initialConfig.getExperiments()?.flags[ExperimentFlags.ENABLE_ADMIN_CONTROLS]
      ?.boolValue ?? false;

  // Initialize final config parameters to the previous parameters.
  // If no admin controls are needed, these will be used as-is for the final
  // config.
  const finalConfigParams = { ...configParams };
  if (adminControlsEnabled) {
    const adminSettings = await fetchAdminControlsOnce(
      codeAssistServer,
      adminControlsEnabled,
    );

    // Admin settings are able to be undefined if unset, but if any are present,
    // we should initialize them all.
    // If any are present, undefined settings should be treated as if they were
    // set to false.
    // If NONE are present, disregard admin settings entirely, and pass the
    // final config as is.
    if (Object.keys(adminSettings).length !== 0) {
      finalConfigParams.disableYoloMode = !adminSettings.strictModeDisabled;
      finalConfigParams.mcpEnabled = adminSettings.mcpSetting?.mcpEnabled;
      finalConfigParams.extensionsEnabled =
        adminSettings.cliFeatureSetting?.extensionsSetting?.extensionsEnabled;
    }
  }

  const config = new Config(finalConfigParams);

  // Needed to initialize ToolRegistry, and git checkpointing if enabled
  await config.initialize();
  startupProfiler.flush(config);

  await refreshAuthentication(config, adcFilePath, 'Config');

  return config;
}

export function setTargetDir(agentSettings: AgentSettings | undefined): string {
  const originalCWD = process.cwd();
  const targetDir =
    process.env['CODER_AGENT_WORKSPACE_PATH'] ??
    (agentSettings?.kind === CoderAgentEvent.StateAgentSettingsEvent
      ? agentSettings.workspacePath
      : undefined);

  if (!targetDir) {
    return originalCWD;
  }

  logger.info(
    `[CoderAgentExecutor] Overriding workspace path to: ${targetDir}`,
  );

  try {
    const resolvedPath = path.resolve(targetDir);
    process.chdir(resolvedPath);
    return resolvedPath;
  } catch (e) {
    logger.error(
      `[CoderAgentExecutor] Error resolving workspace path: ${e}, returning original os.cwd()`,
    );
    return originalCWD;
  }
}

export function loadEnvironment(): void {
  const envFilePath = findEnvFile(process.cwd());
  if (envFilePath) {
    dotenv.config({ path: envFilePath, override: true });
  }
}

function findEnvFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    // prefer codefly-specific .env under CODEFLY_DIR
    const codeflyEnvPath = path.join(currentDir, CODEFLY_DIR, '.env');
    if (fs.existsSync(codeflyEnvPath)) {
      return codeflyEnvPath;
    }
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir || !parentDir) {
      // check .env under home as fallback, again preferring codefly-specific .env
      const homeCodeflyEnvPath = path.join(process.cwd(), CODEFLY_DIR, '.env');
      if (fs.existsSync(homeCodeflyEnvPath)) {
        return homeCodeflyEnvPath;
      }
      const homeEnvPath = path.join(homedir(), '.env');
      if (fs.existsSync(homeEnvPath)) {
        return homeEnvPath;
      }
      return null;
    }
    currentDir = parentDir;
  }
}

async function refreshAuthentication(
  config: Config,
  adcFilePath: string | undefined,
  logPrefix: string,
): Promise<void> {
  if (process.env['USE_CCPA']) {
    logger.info(`[${logPrefix}] Using CCPA Auth:`);
    try {
      if (adcFilePath) {
        path.resolve(adcFilePath);
      }
    } catch (e) {
      logger.error(
        `[${logPrefix}] USE_CCPA env var is true but unable to resolve GOOGLE_APPLICATION_CREDENTIALS file path ${adcFilePath}. Error ${e}`,
      );
    }
    await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
    logger.info(
      `[${logPrefix}] GOOGLE_CLOUD_PROJECT: ${process.env['GOOGLE_CLOUD_PROJECT']}`,
    );
  } else if (process.env['CODEFLY_API_KEY']) {
    logger.info(`[${logPrefix}] Using Codefly API Key`);
    await config.refreshAuth(AuthType.USE_CODEFLY);
  } else {
    const errorMessage = `[${logPrefix}] Unable to set GeneratorConfig. Please provide a CODEFLY_API_KEY or set USE_CCPA.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}
