/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { CODEFLY_DIR, homedir } from '../utils/paths.js';

export const OAUTH_FILE = 'oauth_creds.json';
const TMP_DIR_NAME = 'tmp';
const BIN_DIR_NAME = 'bin';
const AGENTS_DIR_NAME = '.agents';

export const AUTO_SAVED_POLICY_FILENAME = 'auto-saved.toml';

export class Storage {
  private readonly targetDir: string;
  private readonly sessionId: string | undefined;
  private projectIdentifier: string | undefined;
  private initPromise: Promise<void> | undefined;
  private customPlansDir: string | undefined;

  constructor(targetDir: string, sessionId?: string) {
    this.targetDir = targetDir;
    this.sessionId = sessionId;
  }

  setCustomPlansDir(dir: string | undefined): void {
    this.customPlansDir = dir;
  }

  static getGlobalCodeflyDir(): string {
    const homeDir = homedir();
    if (!homeDir) {
      return path.join(os.tmpdir(), CODEFLY_DIR);
    }
    return path.join(homeDir, CODEFLY_DIR);
  }

  static getGlobalAgentsDir(): string {
    const homeDir = homedir();
    if (!homeDir) {
      return '';
    }
    return path.join(homeDir, AGENTS_DIR_NAME);
  }

  static getMcpOAuthTokensPath(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'mcp-oauth-tokens.json');
  }

  static getGlobalSettingsPath(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'settings.json');
  }

  static getInstallationIdPath(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'installation_id');
  }

  static getGoogleAccountsPath(): string {
    return path.join(Storage.getGlobalCodeflyDir(), GOOGLE_ACCOUNTS_FILENAME);
  }

  static getUserCommandsDir(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'commands');
  }

  static getUserSkillsDir(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'skills');
  }

  static getUserAgentSkillsDir(): string {
    return path.join(Storage.getGlobalAgentsDir(), 'skills');
  }

  static getGlobalMemoryFilePath(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'memory.md');
  }

  static getUserPoliciesDir(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'policies');
  }

  static getUserAgentsDir(): string {
    return path.join(Storage.getGlobalCodeflyDir(), 'agents');
  }

  static getAcknowledgedAgentsPath(): string {
    return path.join(
      Storage.getGlobalGeminiDir(),
      'acknowledgments',
      'agents.json',
    );
  }

  static getPolicyIntegrityStoragePath(): string {
    return path.join(Storage.getGlobalGeminiDir(), 'policy_integrity.json');
  }

  private static getSystemConfigDir(): string {
    if (os.platform() === 'darwin') {
      return '/Library/Application Support/GeminiCli';
    } else if (os.platform() === 'win32') {
      return 'C:\\ProgramData\\gemini-cli';
    } else {
      return '/etc/gemini-cli';
    }
  }

  static getSystemSettingsPath(): string {
    if (process.env['CODEFLY_CLI_SYSTEM_SETTINGS_PATH']) {
      return process.env['CODEFLY_CLI_SYSTEM_SETTINGS_PATH'];
    }
    if (os.platform() === 'darwin') {
      return '/Library/Application Support/Codefly/settings.json';
    } else if (os.platform() === 'win32') {
      return 'C:\\ProgramData\\codefly-cli\\settings.json';
    } else {
      return '/etc/codefly-cli/settings.json';
    }
  }

  static getSystemPoliciesDir(): string {
    return path.join(Storage.getSystemConfigDir(), 'policies');
  }

  static getGlobalTempDir(): string {
    return path.join(Storage.getGlobalCodeflyDir(), TMP_DIR_NAME);
  }

  static getGlobalBinDir(): string {
    return path.join(Storage.getGlobalTempDir(), BIN_DIR_NAME);
  }

  getCodeflyDir(): string {
    return path.join(this.targetDir, CODEFLY_DIR);
  }

  getAgentsDir(): string {
    return path.join(this.targetDir, AGENTS_DIR_NAME);
  }

  getProjectTempDir(): string {
    const identifier = this.getProjectIdentifier();
    const tempDir = Storage.getGlobalTempDir();
    return path.join(tempDir, identifier);
  }

  getWorkspacePoliciesDir(): string {
    return path.join(this.getGeminiDir(), 'policies');
  }

  getAutoSavedPolicyPath(): string {
    return path.join(
      this.getWorkspacePoliciesDir(),
      AUTO_SAVED_POLICY_FILENAME,
    );
  }

  ensureProjectTempDirExists(): void {
    fs.mkdirSync(this.getProjectTempDir(), { recursive: true });
  }

  static getOAuthCredsPath(): string {
    return path.join(Storage.getGlobalCodeflyDir(), OAUTH_FILE);
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  private getFilePathHash(filePath: string): string {
    return crypto.createHash('sha256').update(filePath).digest('hex');
  }

  getHistoryDir(): string {
    const hash = this.getFilePathHash(this.getProjectRoot());
    const historyDir = path.join(Storage.getGlobalCodeflyDir(), 'history');
    return path.join(historyDir, hash);
  }

  getWorkspaceSettingsPath(): string {
    return path.join(this.getCodeflyDir(), 'settings.json');
  }

  getProjectCommandsDir(): string {
    return path.join(this.getCodeflyDir(), 'commands');
  }

  getProjectSkillsDir(): string {
    return path.join(this.getCodeflyDir(), 'skills');
  }

  getProjectAgentSkillsDir(): string {
    return path.join(this.getAgentsDir(), 'skills');
  }

  getProjectAgentsDir(): string {
    return path.join(this.getCodeflyDir(), 'agents');
  }

  getProjectTempCheckpointsDir(): string {
    return path.join(this.getProjectTempDir(), 'checkpoints');
  }

  getProjectTempLogsDir(): string {
    return path.join(this.getProjectTempDir(), 'logs');
  }

  getProjectTempPlansDir(): string {
    if (this.sessionId) {
      return path.join(this.getProjectTempDir(), this.sessionId, 'plans');
    }
    return path.join(this.getProjectTempDir(), 'plans');
  }

  getPlansDir(): string {
    if (this.customPlansDir) {
      const resolvedPath = path.resolve(
        this.getProjectRoot(),
        this.customPlansDir,
      );
      const realProjectRoot = resolveToRealPath(this.getProjectRoot());
      const realResolvedPath = resolveToRealPath(resolvedPath);

      if (!isSubpath(realProjectRoot, realResolvedPath)) {
        throw new Error(
          `Custom plans directory '${this.customPlansDir}' resolves to '${realResolvedPath}', which is outside the project root '${realProjectRoot}'.`,
        );
      }

      return resolvedPath;
    }
    return this.getProjectTempPlansDir();
  }

  getProjectTempTasksDir(): string {
    if (this.sessionId) {
      return path.join(this.getProjectTempDir(), this.sessionId, 'tasks');
    }
    return path.join(this.getProjectTempDir(), 'tasks');
  }

  async listProjectChatFiles(): Promise<
    Array<{ filePath: string; lastUpdated: string }>
  > {
    const chatsDir = path.join(this.getProjectTempDir(), 'chats');
    try {
      const files = await fs.promises.readdir(chatsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const sessions = await Promise.all(
        jsonFiles.map(async (file) => {
          const absolutePath = path.join(chatsDir, file);
          const stats = await fs.promises.stat(absolutePath);
          return {
            filePath: path.join('chats', file),
            lastUpdated: stats.mtime.toISOString(),
            mtimeMs: stats.mtimeMs,
          };
        }),
      );

      return sessions
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map(({ filePath, lastUpdated }) => ({ filePath, lastUpdated }));
    } catch (e) {
      // If directory doesn't exist, return empty
      if (
        e instanceof Error &&
        'code' in e &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (e as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return [];
      }
      throw e;
    }
  }

  async loadProjectTempFile<T>(filePath: string): Promise<T | null> {
    const absolutePath = path.join(this.getProjectTempDir(), filePath);
    try {
      const content = await fs.promises.readFile(absolutePath, 'utf8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return JSON.parse(content) as T;
    } catch (e) {
      // If file doesn't exist, return null
      if (
        e instanceof Error &&
        'code' in e &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (e as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return null;
      }
      throw e;
    }
  }

  getExtensionsDir(): string {
    return path.join(this.getCodeflyDir(), 'extensions');
  }

  getExtensionsConfigPath(): string {
    return path.join(this.getExtensionsDir(), 'codefly-extension.json');
  }

  getHistoryFilePath(): string {
    return path.join(this.getProjectTempDir(), 'shell_history');
  }
}
