/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useRef, useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useTextBuffer } from '../components/shared/text-buffer.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { clearApiKey, debugLogger, AuthType } from '@codeflyai/codefly-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { keyMatchers, Command } from '../keyMatchers.js';

interface ApiAuthDialogProps {
  onSubmit: (apiKey: string, baseUrl?: string, models?: string) => void;
  onCancel: () => void;
  error?: string | null;
  defaultValue?: string;
  defaultBaseUrl?: string;
  defaultModels?: string;
}

enum FocusedField {
  ApiKey = 'apiKey',
  BaseUrl = 'baseUrl',
  Models = 'models',
}

export function ApiAuthDialog({
  onSubmit,
  onCancel,
  error,
  defaultValue = '',
  defaultBaseUrl = '',
  defaultModels = '',
}: ApiAuthDialogProps): React.JSX.Element {
  const { mainAreaWidth, selectedAuthType } = useUIState();
  const viewportWidth = mainAreaWidth - 8;

  const isOpenAI = selectedAuthType === AuthType.OPENAI;
  const providerName = isOpenAI ? 'OpenAI Compatible' : 'Codefly';
  const keyLink = isOpenAI
    ? 'https://platform.openai.com/api-keys'
    : 'https://aistudio.google.com/app/apikey';

  const [focusedField, setFocusedField] = useState<FocusedField>(
    FocusedField.ApiKey,
  );

  const pendingPromise = useRef<{ cancel: () => void } | null>(null);

  useEffect(
    () => () => {
      pendingPromise.current?.cancel();
    },
    [],
  );

  const buffer = useTextBuffer({
    initialText: defaultValue || '',
    initialCursorOffset: defaultValue?.length || 0,
    viewport: {
      width: viewportWidth,
      height: 4,
    },
    inputFilter: (text) => text.replace(/[\r\n]/g, ''),
    singleLine: true,
  });

  const baseUrlBuffer = useTextBuffer({
    initialText: defaultBaseUrl || '',
    initialCursorOffset: defaultBaseUrl?.length || 0,
    viewport: {
      width: viewportWidth,
      height: 4,
    },
    inputFilter: (text) => text.replace(/[\r\n]/g, ''),
    singleLine: true,
  });

  const modelsBuffer = useTextBuffer({
    initialText: defaultModels || '',
    initialCursorOffset: defaultModels?.length || 0,
    viewport: {
      width: viewportWidth,
      height: 4,
    },
    inputFilter: (text) => text.replace(/[\r\n]/g, ''),
    singleLine: true,
  });

  const handleSubmit = () => {
    onSubmit(buffer.text, baseUrlBuffer.text, modelsBuffer.text);
  };

  const handleClear = () => {
    pendingPromise.current?.cancel();

    let isCancelled = false;
    const wrappedPromise = new Promise<void>((resolve, reject) => {
      clearApiKey().then(
        () => !isCancelled && resolve(),
        (error) => !isCancelled && reject(error),
      );
    });

    pendingPromise.current = {
      cancel: () => {
        isCancelled = true;
      },
    };

    return wrappedPromise
      .then(() => {
        buffer.setText('');
        baseUrlBuffer.setText('');
        modelsBuffer.setText('');
      })
      .catch((err) => {
        debugLogger.debug('Failed to clear API key:', err);
      });
  };

  useKeypress(
    (key) => {
      if (keyMatchers[Command.CLEAR_INPUT](key)) {
        void handleClear();
        return true;
      }

      if (key.name === 'tab' || key.name === 'down' || key.name === 'up') {
        if (isOpenAI) {
          setFocusedField((prev) => {
            if (prev === FocusedField.ApiKey) return FocusedField.BaseUrl;
            if (prev === FocusedField.BaseUrl) return FocusedField.Models;
            return FocusedField.ApiKey;
          });
        }
      }
      return false;
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.focused}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={theme.text.primary}>
        Enter {providerName} Configuration
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.primary}>
          Please enter your {providerName} API key and Base URL (optional).
        </Text>
        <Text color={theme.text.secondary}>
          You can get an API key from{' '}
          <Text color={theme.text.link}>{keyLink}</Text>
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text
          color={theme.text.primary}
          bold={focusedField === FocusedField.ApiKey}
        >
          API Key:
        </Text>
        <Box
          borderStyle="round"
          borderColor={
            focusedField === FocusedField.ApiKey
              ? theme.border.focused
              : theme.border.default
          }
          paddingX={1}
        >
          <TextInput
            buffer={buffer}
            onSubmit={
              isOpenAI
                ? () => setFocusedField(FocusedField.BaseUrl)
                : handleSubmit
            }
            onCancel={onCancel}
            placeholder="Paste your API key here"
            focus={focusedField === FocusedField.ApiKey}
            mask={true}
          />
        </Box>
      </Box>

      {isOpenAI && (
        <>
          <Box marginTop={0} flexDirection="column">
            <Text
              color={theme.text.primary}
              bold={focusedField === FocusedField.BaseUrl}
            >
              Base URL (optional):
            </Text>
            <Box
              borderStyle="round"
              borderColor={
                focusedField === FocusedField.BaseUrl
                  ? theme.border.focused
                  : theme.border.default
              }
              paddingX={1}
            >
              <TextInput
                buffer={baseUrlBuffer}
                onSubmit={() => setFocusedField(FocusedField.Models)}
                onCancel={() => setFocusedField(FocusedField.ApiKey)}
                placeholder="https://api.openai.com/v1"
                focus={focusedField === FocusedField.BaseUrl}
              />
            </Box>
          </Box>

          <Box marginTop={0} flexDirection="column">
            <Text
              color={theme.text.primary}
              bold={focusedField === FocusedField.Models}
            >
              Model Names (optional, comma-separated):
            </Text>
            <Box
              borderStyle="round"
              borderColor={
                focusedField === FocusedField.Models
                  ? theme.border.focused
                  : theme.border.default
              }
              paddingX={1}
            >
              <TextInput
                buffer={modelsBuffer}
                onSubmit={handleSubmit}
                onCancel={() => setFocusedField(FocusedField.BaseUrl)}
                placeholder="gpt-4o,gpt-4o-mini"
                focus={focusedField === FocusedField.Models}
              />
            </Box>
          </Box>
        </>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          (Press Tab/Arrows to switch fields, Enter to submit, Esc to cancel,
          Ctrl+C to clear)
        </Text>
      </Box>
    </Box>
  );
}
