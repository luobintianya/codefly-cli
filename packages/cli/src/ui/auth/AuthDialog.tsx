/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import type { LoadedSettings } from '../../config/settings.js';
import { AuthType } from '@codeflyai/codefly-core';
import { useKeypress } from '../hooks/useKeypress.js';

import { validateAuthMethodWithSettings } from './useAuth.js';

interface AuthDialogProps {
  settings: LoadedSettings;
  onSelect: (authType: AuthType | undefined) => Promise<void>;
  authError: string | null;
  onAuthError: (error: string | null) => void;
}

export function AuthDialog({
  settings,
  onSelect,
  authError,
  onAuthError,
}: AuthDialogProps): React.JSX.Element {
  let items = [
    {
      label: 'OpenAI Compatible',
      value: AuthType.OPENAI,
      key: AuthType.OPENAI,
    },
    {
      label: 'Use Gemini API Key',
      value: AuthType.USE_GEMINI,
      key: AuthType.USE_GEMINI,
    },
    {
      label: 'Login with Google',
      value: AuthType.LOGIN_WITH_GOOGLE,
      key: AuthType.LOGIN_WITH_GOOGLE,
    },
    {
      label: 'Vertex AI',
      value: AuthType.USE_VERTEX_AI,
      key: AuthType.USE_VERTEX_AI,
    },
    ...(process.env['CLOUD_SHELL'] === 'true'
      ? [
          {
            label: 'Use Cloud Shell user credentials',
            value: AuthType.COMPUTE_ADC,
            key: AuthType.COMPUTE_ADC,
          },
        ]
      : process.env['GEMINI_CLI_USE_COMPUTE_ADC'] === 'true'
        ? [
            {
              label: 'Use metadata server application default credentials',
              value: AuthType.COMPUTE_ADC,
              key: AuthType.COMPUTE_ADC,
            },
          ]
        : []),
  ];

  if (settings.merged.security.auth.enforcedType) {
    items = items.filter(
      (item) => item.value === settings.merged.security.auth.enforcedType,
    );
  }

  let defaultAuthType = null;
  const defaultAuthTypeEnv = process.env['GEMINI_DEFAULT_AUTH_TYPE'];
  if (
    defaultAuthTypeEnv &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    Object.values(AuthType).includes(defaultAuthTypeEnv as AuthType)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    defaultAuthType = defaultAuthTypeEnv as AuthType;
  }

  // Only use the explicitly saved selectedType or admin-configured default.
  // Do NOT fall back to env vars (GEMINI_API_KEY, OPENAI_API_KEY, etc.) so
  // that the dialog always reflects the user's last explicit choice.
  const preferredAuthType =
    settings.merged.security.auth.selectedType || defaultAuthType;

  let initialAuthIndex = items.findIndex(
    (item) => item.value === preferredAuthType,
  );

  if (initialAuthIndex === -1) {
    initialAuthIndex = 0;
  }
  if (settings.merged.security.auth.enforcedType) {
    initialAuthIndex = 0;
  }

  const handleAuthSelect = (authMethod: AuthType) => {
    const error = validateAuthMethodWithSettings(authMethod, settings);
    if (error) {
      onAuthError(error);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onSelect(authMethod);
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (authError) {
          return true;
        }
        if (settings.merged.security.auth.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          onAuthError(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
          return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        onSelect(undefined);
      }
      return false;
    },
    { isActive: true },
  );

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
            Terms of Services and Privacy Notice for Codefly cli
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.link}>
            {'https://geminicli.com/docs/resources/tos-privacy/'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
