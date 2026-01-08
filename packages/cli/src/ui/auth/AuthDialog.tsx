/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import type {
  LoadableSettingScope,
  LoadedSettings,
} from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';
import {
  AuthType,
  // clearCachedCredentialFile,
} from '@codefly/codefly-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { AuthState } from '../types.js';
// import { runExitCleanup } from '../../utils/cleanup.js';

interface AuthDialogProps {
  settings: LoadedSettings;
  setAuthState: (state: AuthState) => void;
  authError: string | null;
  onAuthError: (error: string | null) => void;
}

// ... imports ...

// Simple text input component for config collection
function SimpleTextInput({
  label,
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  mask = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  mask?: boolean;
}) {
  useKeypress(
    (key) => {
      if (key.name === 'return') {
        onSubmit();
        return;
      }
      if (key.name === 'escape') {
        onCancel();
        return;
      }
      if (key.name === 'backspace') {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.name === 'space') {
        onChange(value + ' ');
        return;
      }
      if (key.ctrl || key.meta) return;
      if (key.sequence && key.sequence.length === 1) {
        onChange(value + key.sequence);
      }
    },
    { isActive: true },
  );

  const displayValue = mask ? '*'.repeat(value.length) : value;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{label}</Text>
      <Box borderStyle="round" borderColor={theme.border.focused} paddingX={1}>
        <Text>
          {displayValue}
          {displayValue.length === 0 && placeholder ? (
            <Text color={theme.text.secondary}>{placeholder}</Text>
          ) : null}
          <Text color={theme.text.accent}>█</Text>
        </Text>
      </Box>
      <Text color={theme.text.secondary}>
        (Enter to confirm, Esc to cancel)
      </Text>
    </Box>
  );
}

export function AuthDialog({
  settings,
  setAuthState,
  authError,
  onAuthError,
}: AuthDialogProps): React.JSX.Element {
  // Wizard state
  const [configStep, setConfigStep] = useState<
    'none' | 'baseUrl' | 'model' | 'apiKey'
  >('none');
  const [openaiConfig, setOpenaiConfig] = useState({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: '',
  });

  let items = [
    {
      label: 'Use Gemini API Key',
      value: AuthType.USE_GEMINI,
      key: AuthType.USE_GEMINI,
    },
    {
      label: 'Vertex AI',
      value: AuthType.USE_VERTEX_AI,
      key: AuthType.USE_VERTEX_AI,
    },
    {
      label: 'OpenAI Compatible',
      value: AuthType.OPENAI,
      key: AuthType.OPENAI,
    },
  ];

  if (settings.merged.security?.auth?.enforcedType) {
    items = items.filter(
      (item) => item.value === settings.merged.security?.auth?.enforcedType,
    );
  }

  let defaultAuthType = null;
  const defaultAuthTypeEnv = process.env['GEMINI_DEFAULT_AUTH_TYPE'];
  if (
    defaultAuthTypeEnv &&
    Object.values(AuthType).includes(defaultAuthTypeEnv as AuthType)
  ) {
    defaultAuthType = defaultAuthTypeEnv as AuthType;
  }

  let initialAuthIndex = items.findIndex((item) => {
    if (settings.merged.security?.auth?.selectedType) {
      return item.value === settings.merged.security.auth.selectedType;
    }

    if (defaultAuthType) {
      return item.value === defaultAuthType;
    }

    if (process.env['GEMINI_API_KEY']) {
      return item.value === AuthType.USE_GEMINI;
    }

    return false;
  });
  // Default to 0 if not found
  if (initialAuthIndex === -1) initialAuthIndex = 0;

  if (settings.merged.security?.auth?.enforcedType) {
    initialAuthIndex = 0;
  }

  const onSelect = useCallback(
    async (authType: AuthType | undefined, scope: LoadableSettingScope) => {
      if (authType) {
        if (authType === AuthType.OPENAI) {
          // Start wizard
          setAuthState(AuthState.AwaitingOpenAIConfig);
          setConfigStep('baseUrl');
          return;
        }

        // await clearCachedCredentialFile();
        settings.setValue(scope, 'security.auth.selectedType', authType);
        // Google login check removed

        if (authType === AuthType.USE_GEMINI) {
          if (process.env['GEMINI_API_KEY'] !== undefined) {
            setAuthState(AuthState.Unauthenticated);
            return;
          } else {
            setAuthState(AuthState.AwaitingApiKeyInput);
            return;
          }
        }
      }
      setAuthState(AuthState.Unauthenticated);
    },
    [settings, setAuthState],
  );

  const handleAuthSelect = (authMethod: AuthType) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    onSelect(authMethod, SettingScope.User);
  };

  const handleWizardSubmit = useCallback(() => {
    if (configStep === 'baseUrl') {
      setConfigStep('model');
    } else if (configStep === 'model') {
      setConfigStep('apiKey');
    } else if (configStep === 'apiKey') {
      // Save all settings
      settings.setValue(
        SettingScope.User,
        'security.auth.openai.baseUrl',
        openaiConfig.baseUrl,
      );
      settings.setValue(
        SettingScope.User,
        'security.auth.openai.model',
        openaiConfig.model,
      );
      settings.setValue(
        SettingScope.User,
        'security.auth.openai.apiKey',
        openaiConfig.apiKey,
      );
      settings.setValue(
        SettingScope.User,
        'security.auth.selectedType',
        AuthType.OPENAI,
      );

      // Reset wizard and trigger auth flow
      setConfigStep('none');
      setAuthState(AuthState.Unauthenticated); // This triggers useAuth to verify
    }
  }, [configStep, openaiConfig, settings, setAuthState]);

  useKeypress(
    (key) => {
      if (configStep !== 'none') return; // Handled by SimpleTextInput

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (authError) {
          return;
        }
        if (settings.merged.security?.auth?.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          onAuthError(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        onSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  if (configStep !== 'none') {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.focused}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={theme.text.primary}>
          OpenAI Compatible Configuration
        </Text>
        {configStep === 'baseUrl' && (
          <SimpleTextInput
            label="Base URL"
            value={openaiConfig.baseUrl}
            onChange={(val) =>
              setOpenaiConfig((prev) => ({ ...prev, baseUrl: val }))
            }
            onSubmit={handleWizardSubmit}
            onCancel={() => {
              setConfigStep('none');
              setAuthState(AuthState.Unauthenticated);
            }}
            placeholder="https://api.openai.com/v1"
          />
        )}
        {configStep === 'model' && (
          <SimpleTextInput
            label="Model Name"
            value={openaiConfig.model}
            onChange={(val) =>
              setOpenaiConfig((prev) => ({ ...prev, model: val }))
            }
            onSubmit={handleWizardSubmit}
            onCancel={() => {
              setConfigStep('none');
              setAuthState(AuthState.Unauthenticated);
            }}
            placeholder="gpt-4o"
          />
        )}
        {configStep === 'apiKey' && (
          <SimpleTextInput
            label="API Key"
            value={openaiConfig.apiKey}
            onChange={(val) =>
              setOpenaiConfig((prev) => ({ ...prev, apiKey: val }))
            }
            onSubmit={handleWizardSubmit}
            onCancel={() => {
              setConfigStep('none');
              setAuthState(AuthState.Unauthenticated);
            }}
            mask={true}
          />
        )}
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.focused}
      flexDirection="row"
      padding={1}
      width="100%"
      alignItems="flex-start"
    >
      <Text color={theme.text.accent}>? </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text bold color={theme.text.primary}>
          Get started
        </Text>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            How would you like to authenticate for this project?
          </Text>
        </Box>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={items}
            initialIndex={initialAuthIndex}
            onSelect={handleAuthSelect}
            onHighlight={() => {
              onAuthError(null);
            }}
          />
        </Box>
        {authError && (
          <Box marginTop={1}>
            <Text color={theme.status.error}>{authError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Use Enter to select)</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            Terms of Services and Privacy Notice for Codefly
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.link}>
            {'https://github.com/codefly/codefly/blob/main/docs/tos-privacy.md'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
