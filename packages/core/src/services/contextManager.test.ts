/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextManager } from './contextManager.js';
import * as memoryDiscovery from '../utils/memoryDiscovery.js';
import type { Config } from '../config/config.js';
import { coreEvents, CoreEvent } from '../utils/events.js';

// Mock memoryDiscovery module
vi.mock('../utils/memoryDiscovery.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../utils/memoryDiscovery.js')>();
  return {
    ...actual,
    getGlobalMemoryPaths: vi.fn(),
    getExtensionMemoryPaths: vi.fn(),
    getEnvironmentMemoryPaths: vi.fn(),
    readCodeflyMdFiles: vi.fn(),
    loadJitSubdirectoryMemory: vi.fn(),
    categorizeAndConcatenate: vi.fn(),
    concatenateInstructions: vi
      .fn()
      .mockImplementation(actual.concatenateInstructions),
  };
});

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      getDebugMode: vi.fn().mockReturnValue(false),
      getWorkingDir: vi.fn().mockReturnValue('/app'),
      getImportFormat: vi.fn().mockReturnValue('tree'),
      getWorkspaceContext: vi.fn().mockReturnValue({
        getDirectories: vi.fn().mockReturnValue(['/app']),
      }),
      getExtensionLoader: vi.fn().mockReturnValue({
        getExtensions: vi.fn().mockReturnValue([]),
      }),
      getMcpClientManager: vi.fn().mockReturnValue({
        getMcpInstructions: vi.fn().mockReturnValue('MCP Instructions'),
      }),
      isTrustedFolder: vi.fn().mockReturnValue(true),
    } as unknown as Config;

    contextManager = new ContextManager(mockConfig);
    vi.clearAllMocks();
    vi.spyOn(coreEvents, 'emit');
    vi.mocked(memoryDiscovery.getExtensionMemoryPaths).mockReturnValue([]);
  });

  describe('refresh', () => {
    it('should load and format global and environment memory', async () => {
      vi.mocked(memoryDiscovery.getGlobalMemoryPaths).mockResolvedValue([
        '/home/user/.codefly/CODEFLY.md',
      ]);
      vi.mocked(memoryDiscovery.getEnvironmentMemoryPaths).mockResolvedValue([
        '/app/CODEFLY.md',
      ]);
      vi.mocked(memoryDiscovery.readCodeflyMdFiles).mockResolvedValue([
        {
          filePath: '/home/user/.codefly/CODEFLY.md',
          content: 'Global Content',
        },
        { filePath: '/app/CODEFLY.md', content: 'Env Content' },
      ]);
      vi.mocked(memoryDiscovery.categorizeAndConcatenate).mockReturnValue({
        global:
          '--- Context from: /home/user/.codefly/CODEFLY.md ---\nGlobal Content',
        extension: '',
        project: '--- Context from: /app/CODEFLY.md ---\nEnv Content',
      });

      await contextManager.refresh();

      expect(memoryDiscovery.getGlobalMemoryPaths).toHaveBeenCalledWith(false);
      expect(contextManager.getGlobalMemory()).toContain(
        '--- Context from: /home/user/.codefly/CODEFLY.md ---',
      );
      expect(contextManager.getGlobalMemory()).toContain('Global Content');

      expect(memoryDiscovery.getEnvironmentMemoryPaths).toHaveBeenCalledWith(
        ['/app'],
        false,
      );
      expect(contextManager.getEnvironmentMemory()).toContain(
        '--- Context from: /app/CODEFLY.md ---',
      );

      expect(contextManager.getGlobalMemory()).toContain('Global Content');
      expect(contextManager.getEnvironmentMemory()).toContain('Env Content');
      expect(contextManager.getEnvironmentMemory()).toContain(
        'MCP Instructions',
      );

      expect(contextManager.getLoadedPaths()).toContain(
        '/home/user/.codefly/CODEFLY.md',
      );
      expect(contextManager.getLoadedPaths()).toContain('/app/CODEFLY.md');
    });

    it('should emit MemoryChanged event when memory is refreshed', async () => {
      vi.mocked(memoryDiscovery.getGlobalMemoryPaths).mockResolvedValue([
        '/home/user/.codefly/CODEFLY.md',
      ]);
      vi.mocked(memoryDiscovery.getEnvironmentMemoryPaths).mockResolvedValue([
        '/app/CODEFLY.md',
      ]);
      vi.mocked(memoryDiscovery.readCodeflyMdFiles).mockResolvedValue([
        {
          filePath: '/home/user/.codefly/CODEFLY.md',
          content: 'Global Content',
        },
        { filePath: '/app/CODEFLY.md', content: 'Env Content' },
      ]);
      vi.mocked(memoryDiscovery.categorizeAndConcatenate).mockReturnValue({
        global: '',
        extension: '',
        project: '',
      });

      await contextManager.refresh();

      expect(coreEvents.emit).toHaveBeenCalledWith(CoreEvent.MemoryChanged, {
        fileCount: 2,
      });
    });

    it('should not load environment memory if folder is not trusted', async () => {
      vi.mocked(mockConfig.isTrustedFolder).mockReturnValue(false);
      vi.mocked(memoryDiscovery.getGlobalMemoryPaths).mockResolvedValue([
        '/home/user/.codefly/CODEFLY.md',
      ]);
      vi.mocked(memoryDiscovery.readCodeflyMdFiles).mockResolvedValue([
        {
          filePath: '/home/user/.codefly/CODEFLY.md',
          content: 'Global Content',
        },
      ]);
      vi.mocked(memoryDiscovery.categorizeAndConcatenate).mockReturnValue({
        global:
          '--- Context from: /home/user/.codefly/CODEFLY.md ---\nGlobal Content',
        extension: '',
        project: '',
      });

      await contextManager.refresh();

      expect(memoryDiscovery.getEnvironmentMemoryPaths).not.toHaveBeenCalled();
      expect(contextManager.getEnvironmentMemory()).toBe('');
      expect(contextManager.getGlobalMemory()).toContain('Global Content');
    });
  });

  describe('discoverContext', () => {
    it('should discover and load new context', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = {
        files: [{ path: '/app/src/CODEFLY.md', content: 'Src Content' }],
      };
      vi.mocked(memoryDiscovery.loadJitSubdirectoryMemory).mockResolvedValue(
        mockResult,
      );
      vi.mocked(memoryDiscovery.concatenateInstructions).mockReturnValue(
        '--- Context from: /app/src/CODEFLY.md ---\nSrc Content',
      );

      const result = await contextManager.discoverContext('/app/src/file.ts', [
        '/app',
      ]);

      expect(memoryDiscovery.loadJitSubdirectoryMemory).toHaveBeenCalledWith(
        '/app/src/file.ts',
        ['/app'],
        expect.any(Set),
        false,
      );
      expect(result).toContain('--- Context from: /app/src/CODEFLY.md ---');
      expect(result).toContain('Src Content');
      expect(contextManager.getLoadedPaths()).toContain('/app/src/CODEFLY.md');
    });

    it('should return empty string if no new files found', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = {
        files: [],
      };
      vi.mocked(memoryDiscovery.loadJitSubdirectoryMemory).mockResolvedValue(
        mockResult,
      );

      const result = await contextManager.discoverContext('/app/src/file.ts', [
        '/app',
      ]);

      expect(result).toBe('');
    });

    it('should return empty string if folder is not trusted', async () => {
      vi.mocked(mockConfig.isTrustedFolder).mockReturnValue(false);

      const result = await contextManager.discoverContext('/app/src/file.ts', [
        '/app',
      ]);

      expect(memoryDiscovery.loadJitSubdirectoryMemory).not.toHaveBeenCalled();
      expect(result).toBe('');
    });
  });
});
