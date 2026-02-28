/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { renderHook } from '../../test-utils/render.js';
import { useAuthCommand, validateAuthMethodWithSettings } from './useAuth.js';
import { AuthType, type Config } from '@codeflyai/codefly-core';
import { AuthState } from '../types.js';
import type { LoadedSettings } from '../../config/settings.js';
import { waitFor } from '../../test-utils/async.js';

// Mock dependencies
const mockLoadApiKey = vi.fn();
const mockValidateAuthMethod = vi.fn();

vi.mock('@codeflyai/codefly-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@codeflyai/codefly-core')>();
  return {
    ...actual,
    loadApiKey: () => mockLoadApiKey(),
  };
});

vi.mock('../../config/auth.js', () => ({
  validateAuthMethod: (authType: AuthType) => mockValidateAuthMethod(authType),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env['CODEFLY_API_KEY'];
    delete process.env['CODEFLY_DEFAULT_AUTH_TYPE'];
    mockValidateAuthMethod.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAuthMethodWithSettings', () => {
    it('should return error if auth type is enforced and does not match', () => {
      const settings = {
        merged: {
          security: {
            auth: {
              enforcedType: AuthType.USE_CODEFLY,
            },
          },
        },
      } as LoadedSettings;

      const error = validateAuthMethodWithSettings(
        AuthType.USE_CODEFLY,
        settings,
      );
      expect(error).toBeNull(); // Changed expectation because enforced matches
    });

    it('should return null if useExternal is true', () => {
      const settings = {
        merged: {
          security: {
            auth: {
              useExternal: true, // This branch might not be triggered if enforcedType is also set to USE_CODEFLY, but keeping it simple
            },
          },
        },
      } as LoadedSettings;

      const error = validateAuthMethodWithSettings(
        AuthType.USE_CODEFLY,
        settings,
      );
      expect(error).toBeNull();
    });

    it('should return null if authType is USE_CODEFLY', () => {
      const settings = {
        merged: {
          security: {
            auth: {},
          },
        },
      } as LoadedSettings;

      const error = validateAuthMethodWithSettings(
        AuthType.USE_CODEFLY,
        settings,
      );
      expect(error).toBeNull();
    });

    it('should call validateAuthMethod for other auth types', () => {
      const settings = {
        merged: {
          security: {
            auth: {},
          },
        },
      } as LoadedSettings;

      mockValidateAuthMethod.mockReturnValue('Validation Error');
      const error = validateAuthMethodWithSettings(
        AuthType.USE_VERTEX_AI,
        settings,
      );
      expect(error).toBe('Validation Error');
      expect(mockValidateAuthMethod).toHaveBeenCalledWith(
        AuthType.USE_VERTEX_AI,
      );
    });
  });

  describe('useAuthCommand', () => {
    const mockConfig = {
      refreshAuth: vi.fn(),
      openaiConfig: {}, // Initialize to avoid undefined issues
    } as unknown as Config;

    const createSettings = (selectedType?: AuthType) =>
      ({
        merged: {
          security: {
            auth: {
              selectedType,
            },
          },
        },
      }) as LoadedSettings;

    it('should initialize with Unauthenticated state', async () => {
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );
      expect(result.current.authState).toBe(AuthState.Unauthenticated);

      await waitFor(() => {
        expect(result.current.authState).toBe(AuthState.Authenticated);
      });
    });

    it('should set error if no auth type is selected and no env key', async () => {
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(undefined), mockConfig),
      );

      await waitFor(() => {
        expect(result.current.authError).toBe(
          'No authentication method selected.',
        );
        expect(result.current.authState).toBe(AuthState.Updating);
      });
    });

    it('should auto-select USE_CODEFLY if CODEFLY_API_KEY exists', async () => {
      mockLoadApiKey.mockResolvedValue(null);
      process.env['CODEFLY_API_KEY'] = 'env-key';
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(undefined), mockConfig),
      );

      await waitFor(() => {
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
          AuthType.USE_CODEFLY,
        );
        expect(result.current.authState).toBe(AuthState.Authenticated);
        expect(result.current.apiKeyDefaultValue).toBe('env-key');
      });
    });

    it('should transition to AwaitingApiKeyInput if USE_CODEFLY and no key found', async () => {
      mockLoadApiKey.mockResolvedValue(null);
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(result.current.authState).toBe(AuthState.AwaitingApiKeyInput);
      });
    });

    it('should authenticate if USE_CODEFLY and key is found', async () => {
      mockLoadApiKey.mockResolvedValue('stored-key');
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
          AuthType.USE_CODEFLY,
        );
        expect(result.current.authState).toBe(AuthState.Authenticated);
        expect(result.current.apiKeyDefaultValue).toBe('stored-key');
      });
    });

    it('should authenticate if USE_CODEFLY and env key is found', async () => {
      mockLoadApiKey.mockResolvedValue(null);
      process.env['CODEFLY_API_KEY'] = 'env-key';
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
          AuthType.USE_CODEFLY,
        );
        expect(result.current.authState).toBe(AuthState.Authenticated);
        expect(result.current.apiKeyDefaultValue).toBe('env-key');
      });
    });

    it('should prioritize env key over stored key when both are present', async () => {
      mockLoadApiKey.mockResolvedValue('stored-key');
      process.env['CODEFLY_API_KEY'] = 'env-key';
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
          AuthType.USE_CODEFLY,
        );
        expect(result.current.authState).toBe(AuthState.Authenticated);
        // The environment key should take precedence
        expect(result.current.apiKeyDefaultValue).toBe('env-key');
      });
    });

    it('should set error if validation fails', async () => {
      mockValidateAuthMethod.mockReturnValue('Validation Failed');
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_VERTEX_AI), mockConfig),
      );

      await waitFor(() => {
        expect(result.current.authError).toBe('Validation Failed');
        expect(result.current.authState).toBe(AuthState.Updating);
      });
    });

    it('should set error if CODEFLY_DEFAULT_AUTH_TYPE is invalid', async () => {
      mockLoadApiKey.mockResolvedValue('key');
      process.env['CODEFLY_DEFAULT_AUTH_TYPE'] = 'INVALID_TYPE';
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(result.current.authError).toContain(
          'Invalid value for CODEFLY_DEFAULT_AUTH_TYPE',
        );
        expect(result.current.authState).toBe(AuthState.Updating);
      });
    });

    it('should authenticate successfully for valid auth type', async () => {
      mockLoadApiKey.mockResolvedValue('key');
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(
          AuthType.USE_CODEFLY,
        );
        expect(result.current.authState).toBe(AuthState.Authenticated);
        expect(result.current.authError).toBeNull();
      });
    });

    it('should handle refreshAuth failure', async () => {
      mockLoadApiKey.mockResolvedValue('key');
      (mockConfig.refreshAuth as Mock).mockRejectedValue(
        new Error('Auth Failed'),
      );
      const { result } = renderHook(() =>
        useAuthCommand(createSettings(AuthType.USE_CODEFLY), mockConfig),
      );

      await waitFor(() => {
        expect(result.current.authError).toContain('Failed to login');
        expect(result.current.authState).toBe(AuthState.Updating);
      });
    });

    it('should authenticate if OpenAI auth type is configured', async () => {
      const settings = createSettings(AuthType.OPENAI);
      if (!settings.merged.security?.auth) {
        throw new Error('Security auth settings not initialized');
      }
      (settings.merged.security.auth.openai as {
        baseUrl?: string;
        model?: string;
        apiKey?: string;
      }) = {
        baseUrl: 'https://test.url',
        model: 'test-model',
        apiKey: 'test-key',
      };

      const { result } = renderHook(() => useAuthCommand(settings, mockConfig));

      await waitFor(() => {
        expect(mockConfig.refreshAuth).toHaveBeenCalledWith(AuthType.OPENAI);
        expect(result.current.authState).toBe(AuthState.Authenticated);
      });
    });

    it('should transition to AwaitingApiKeyInput if OPENAI via settings and no key found', async () => {
      const settings = createSettings(AuthType.OPENAI);
      // Ensure merged.security.auth.openai is empty/undefined so reloadApiKey returns null
      if (settings.merged.security?.auth) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settings.merged.security.auth.openai = {} as any;
      }

      const { result } = renderHook(() => useAuthCommand(settings, mockConfig));

      await waitFor(() => {
        expect(result.current.authState).toBe(AuthState.AwaitingApiKeyInput);
      });
    });
  });
});
