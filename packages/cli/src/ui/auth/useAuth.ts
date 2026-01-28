/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import {
  AuthType,
  type Config,
  loadApiKey,
  debugLogger,
} from '@codeflyai/codefly-core';
import { getErrorMessage } from '@codeflyai/codefly-core';
import { AuthState } from '../types.js';
import { validateAuthMethod } from '../../config/auth.js';

export function validateAuthMethodWithSettings(
  authType: AuthType,
  settings: LoadedSettings,
): string | null {
  const enforcedType = settings.merged.security.auth.enforcedType;
  if (enforcedType && enforcedType !== authType) {
    return `Authentication is enforced to be ${enforcedType}, but you are currently using ${authType}.`;
  }
  if (settings.merged.security.auth.useExternal) {
    return null;
  }
  // If using API keys, we don't validate it here as we might need to prompt for it.
  if (authType === AuthType.USE_GEMINI || authType === AuthType.OPENAI) {
    return null;
  }
  return validateAuthMethod(authType);
}

export const useAuthCommand = (settings: LoadedSettings, config: Config) => {
  const [authState, setAuthState] = useState<AuthState>(
    AuthState.Unauthenticated,
  );

  const [authError, setAuthError] = useState<string | null>(null);
  const [apiKeyDefaultValue, setApiKeyDefaultValue] = useState<
    string | undefined
  >(undefined);
  const [baseUrlDefaultValue, setBaseUrlDefaultValue] = useState<
    string | undefined
  >(undefined);
  const [modelsDefaultValue, setModelsDefaultValue] = useState<
    string | undefined
  >(undefined);

  const onAuthError = useCallback(
    (error: string | null) => {
      setAuthError(error);
      if (error) {
        setAuthState(AuthState.Updating);
      }
    },
    [setAuthError, setAuthState],
  );

  const reloadApiKey = useCallback(
    async (type?: AuthType) => {
      const authType = type ?? settings.merged.security.auth.selectedType;

      if (authType === AuthType.USE_GEMINI) {
        const envKey = process.env['GEMINI_API_KEY'];
        if (envKey !== undefined) {
          setApiKeyDefaultValue(envKey);
          return envKey;
        }

        const storedKey = (await loadApiKey()) ?? '';
        setApiKeyDefaultValue(storedKey);
        return storedKey;
      }

      if (authType === AuthType.OPENAI) {
        const envKey = process.env['OPENAI_API_KEY'];
        const settingsKey = settings.merged.security.auth.openai?.apiKey;
        setApiKeyDefaultValue(envKey || settingsKey);
        setBaseUrlDefaultValue(settings.merged.security.auth.openai?.baseUrl);
        setModelsDefaultValue(settings.merged.security.auth.openai?.models);
        return envKey || settingsKey;
      }

      return undefined;
    },
    [settings],
  );

  useEffect(() => {
    if (authState === AuthState.AwaitingApiKeyInput) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      reloadApiKey();
    }
  }, [authState, reloadApiKey]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      if (
        authState !== AuthState.Unauthenticated &&
        authState !== AuthState.Authenticating
      ) {
        return;
      }

      let authType = settings.merged.security.auth.selectedType;
      if (!authType) {
        // Auto-select based on environment variables if possible
        if (process.env['GEMINI_API_KEY']) {
          authType = AuthType.USE_GEMINI;
        } else if (process.env['OPENAI_API_KEY']) {
          authType = AuthType.OPENAI;
        } else if (
          process.env['GOOGLE_CLOUD_PROJECT'] &&
          process.env['GOOGLE_CLOUD_LOCATION']
        ) {
          authType = AuthType.USE_VERTEX_AI;
        }

        if (!authType) {
          onAuthError('No authentication method selected.');
          return;
        }
      }

      if (authType === AuthType.OPENAI) {
        const key = await reloadApiKey(authType);
        if (!key) {
          return;
        }
      }

      if (authType === AuthType.USE_GEMINI) {
        const key = await reloadApiKey(authType);
        if (!key) {
          setAuthState(AuthState.AwaitingApiKeyInput);
          return;
        }
      }

      const error = validateAuthMethodWithSettings(authType, settings);
      if (error) {
        onAuthError(error);
        return;
      }

      const defaultAuthType = process.env['GEMINI_DEFAULT_AUTH_TYPE'];
      if (
        defaultAuthType &&
        !Object.values(AuthType).includes(defaultAuthType as AuthType)
      ) {
        onAuthError(
          `Invalid value for GEMINI_DEFAULT_AUTH_TYPE: "${defaultAuthType}". ` +
            `Valid values are: ${Object.values(AuthType).join(', ')}.`,
        );
        return;
      }

      try {
        await config.refreshAuth(authType);

        debugLogger.log(`Authenticated via "${authType}".`);
        setAuthError(null);
        setAuthState(AuthState.Authenticated);
      } catch (e) {
        onAuthError(`Failed to login. Message: ${getErrorMessage(e)}`);
      }
    })();
  }, [
    settings,
    config,
    authState,
    setAuthState,
    setAuthError,
    onAuthError,
    reloadApiKey,
  ]);

  return {
    authState,
    setAuthState,
    authError,
    onAuthError,
    apiKeyDefaultValue,
    baseUrlDefaultValue,
    modelsDefaultValue,
    reloadApiKey,
  };
};
