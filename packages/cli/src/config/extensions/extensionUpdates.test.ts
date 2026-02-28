/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getMissingSettings } from './extensionSettings.js';
import type { ExtensionConfig } from '../extension.js';
import {
  debugLogger,
  type ExtensionInstallMetadata,
  type CodeflyCLIExtension,
  coreEvents,
  KeychainTokenStorage,
} from '@codeflyai/codefly-core';
import { EXTENSION_SETTINGS_FILENAME } from './variables.js';
import { ExtensionManager } from '../extension-manager.js';
import { createTestMergedSettings } from '../settings.js';
import { ExtensionStorage } from './storage.js';

let tempHomeDir: string;
let extensionDir: string;

// --- Mocks ---

vi.mock('node:fs', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: vi.fn(),
      statSync: vi.fn(),
      lstatSync: vi.fn(),
      realpathSync: vi.fn((p) => p),
    },
    existsSync: vi.fn(),
    statSync: vi.fn(),
    lstatSync: vi.fn(),
    realpathSync: vi.fn((p) => p),
    promises: {
      ...actual.promises,
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      rm: vi.fn(),
      cp: vi.fn(),
      readFile: vi.fn(),
    },
  };
});

vi.mock('@codeflyai/codefly-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@codeflyai/codefly-core')>();
  return {
    ...actual,
    KeychainTokenStorage: vi.fn(),
    debugLogger: {
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    },
    coreEvents: {
      emitFeedback: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emitConsoleLog: vi.fn(),
    },
    loadSkillsFromDir: vi.fn().mockResolvedValue([]),
    loadAgentsFromDirectory: vi
      .fn()
      .mockResolvedValue({ agents: [], errors: [] }),
    logExtensionInstallEvent: vi.fn().mockResolvedValue(undefined),
    logExtensionUpdateEvent: vi.fn().mockResolvedValue(undefined),
    logExtensionUninstall: vi.fn().mockResolvedValue(undefined),
    logExtensionEnable: vi.fn().mockResolvedValue(undefined),
    logExtensionDisable: vi.fn().mockResolvedValue(undefined),
    Config: vi.fn().mockImplementation(() => ({
      getEnableExtensionReloading: vi.fn().mockReturnValue(true),
    })),
  };
});

vi.mock('./consent.js', () => ({
  maybeRequestConsentOrFail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./extensionSettings.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./extensionSettings.js')>();
  return {
    ...actual,
    getEnvContents: vi.fn().mockResolvedValue({}),
    getMissingSettings: vi.fn(), // We will mock this implementation per test
  };
});

vi.mock('../trustedFolders.js', () => ({
  isWorkspaceTrusted: vi.fn().mockReturnValue({ isTrusted: true }), // Default to trusted to simplify flow
  loadTrustedFolders: vi.fn().mockReturnValue({
    setValue: vi.fn().mockResolvedValue(undefined),
  }),
  TrustLevel: { TRUST_FOLDER: 'TRUST_FOLDER' },
}));

// Mock ExtensionStorage to avoid real FS paths
vi.mock('./storage.js', () => ({
  ExtensionStorage: class {
    constructor(public name: string) {}
    getExtensionDir() {
      return `/mock/extensions/${this.name}`;
    }
    static getUserExtensionsDir() {
      return '/mock/extensions';
    }
    static createTmpDir() {
      return Promise.resolve('/mock/tmp');
    }
  },
}));

vi.mock('os', async (importOriginal) => {
  const mockedOs = await importOriginal<typeof import('node:os')>();
  return {
    ...mockedOs,
    homedir: vi.fn().mockReturnValue('/mock/home'),
  };
});

describe('extensionUpdates', () => {
  let tempWorkspaceDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default fs mocks
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.promises.rm).mockResolvedValue(undefined);
    vi.mocked(fs.promises.cp).mockResolvedValue(undefined);

    // Allow directories to exist by default to satisfy Config/WorkspaceContext checks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);

    // Setup Temp Dirs
    tempHomeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'codefly-cli-test-home-'),
    );
    tempWorkspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'codefly-cli-test-workspace-'),
    );
    extensionDir = path.join(tempHomeDir, '.codefly', 'extensions', 'test-ext');

    // Mock ExtensionStorage to rely on our temp extension dir
    vi.spyOn(ExtensionStorage.prototype, 'getExtensionDir').mockReturnValue(
      extensionDir,
    );
    // Mock getEnvFilePath is checking extensionDir/variables.env? No, it used ExtensionStorage logic.
    // getEnvFilePath in extensionSettings.ts:
    // if workspace, process.cwd()/.env (we need to mock process.cwd or move tempWorkspaceDir there)
    // if user, ExtensionStorage(name).getEnvFilePath() -> joins extensionDir + '.env'

    fs.mkdirSync(extensionDir, { recursive: true });
    vi.mocked(os.homedir).mockReturnValue(tempHomeDir);
    vi.spyOn(process, 'cwd').mockReturnValue(tempWorkspaceDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMissingSettings', () => {
    it('should return empty list if all settings are present', async () => {
      const config: ExtensionConfig = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          { name: 's1', description: 'd1', envVar: 'VAR1' },
          { name: 's2', description: 'd2', envVar: 'VAR2', sensitive: true },
        ],
      };
      const extensionId = '12345';

      // Setup User Env
      const userEnvPath = path.join(extensionDir, EXTENSION_SETTINGS_FILENAME);
      fs.writeFileSync(userEnvPath, 'VAR1=val1');

      // Setup Keychain
      const userKeychain = new KeychainTokenStorage(
        `Codefly CLI Extensions test-ext ${extensionId}`,
      );
      await userKeychain.setSecret('VAR2', 'val2');

      const missing = await getMissingSettings(
        config,
        extensionId,
        tempWorkspaceDir,
      );
      expect(missing).toEqual([]);
    });

    it('should identify missing non-sensitive settings', async () => {
      const config: ExtensionConfig = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [{ name: 's1', description: 'd1', envVar: 'VAR1' }],
      };
      const extensionId = '12345';

      const missing = await getMissingSettings(
        config,
        extensionId,
        tempWorkspaceDir,
      );
      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('s1');
    });

    it('should identify missing sensitive settings', async () => {
      const config: ExtensionConfig = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [
          { name: 's2', description: 'd2', envVar: 'VAR2', sensitive: true },
        ],
      };
      const extensionId = '12345';

      const missing = await getMissingSettings(
        config,
        extensionId,
        tempWorkspaceDir,
      );
      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('s2');
    });

    it('should respect settings present in workspace', async () => {
      const config: ExtensionConfig = {
        name: 'test-ext',
        version: '1.0.0',
        settings: [{ name: 's1', description: 'd1', envVar: 'VAR1' }],
      };
      const extensionId = '12345';

      // Setup Workspace Env
      const workspaceEnvPath = path.join(
        tempWorkspaceDir,
        EXTENSION_SETTINGS_FILENAME,
      );
      fs.writeFileSync(workspaceEnvPath, 'VAR1=val1');

      const missing = await getMissingSettings(
        config,
        extensionId,
        tempWorkspaceDir,
      );
      expect(missing).toEqual([]);
    });
  });

  describe('ExtensionManager integration', () => {
    it(
      'should warn about missing settings after update',
      { timeout: 15000 },
      async () => {
        // Mock ExtensionManager methods to avoid FS/Network usage
        const newConfig: ExtensionConfig = {
          name: 'test-ext',
          version: '1.1.0',
          settings: [{ name: 's1', description: 'd1', envVar: 'VAR1' }],
        };

        const previousConfig: ExtensionConfig = {
          name: 'test-ext',
          version: '1.0.0',
          settings: [],
        };

        const installMetadata: ExtensionInstallMetadata = {
          source: extensionDir,
          type: 'local',
          autoUpdate: true,
        };

        const manager = new ExtensionManager({
          workspaceDir: tempWorkspaceDir,

          settings: createTestMergedSettings({
            telemetry: { enabled: false },
            experimental: { extensionConfig: true },
          }),
          requestConsent: vi.fn().mockResolvedValue(true),
          requestSetting: null, // Simulate non-interactive
        });

        // Mock methods called by installOrUpdateExtension
        vi.spyOn(manager, 'loadExtensionConfig').mockResolvedValue(newConfig);
        vi.spyOn(manager, 'getExtensions').mockReturnValue([
          {
            name: 'test-ext',
            version: '1.0.0',
            installMetadata,
            path: extensionDir,
            // Mocks for other required props
            contextFiles: [],
            mcpServers: {},
            hooks: undefined,
            isActive: true,
            id: 'test-id',
            settings: [],
            resolvedSettings: [],
            skills: [],
          } as unknown as CodeflyCLIExtension,
        ]);
        vi.spyOn(manager, 'uninstallExtension').mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(manager as any, 'loadExtension').mockResolvedValue(
          {} as unknown as CodeflyCLIExtension,
        );
        vi.spyOn(manager, 'enableExtension').mockResolvedValue(undefined);

        // Mock fs.promises for the operations inside installOrUpdateExtension
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
        vi.mocked(fs.existsSync).mockReturnValue(false); // No hooks
        try {
          await manager.installOrUpdateExtension(
            installMetadata,
            previousConfig,
          );
        } catch (_) {
          // Ignore errors from copyExtension or others, we just want to verify the warning
        }

        expect(debugLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Extension "test-ext" has missing settings: s1',
          ),
        );
        expect(coreEvents.emitFeedback).toHaveBeenCalledWith(
          'warning',
          expect.stringContaining(
            'Please run "codefly extensions config test-ext [setting-name]"',
          ),
        );
      },
    );
  });
});
