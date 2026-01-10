/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  PREVIEW_GEMINI_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_MODEL_AUTO,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  AuthType,
} from '@codefly/codefly-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';

interface ModelDialogProps {
  onClose: () => void;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || PREVIEW_GEMINI_FLASH_MODEL;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customModel, setCustomModel] = useState('');

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (showCustomInput) {
          setShowCustomInput(false);
          setCustomModel('');
        } else {
          onClose();
        }
        return;
      }
      if (showCustomInput) {
        if (key.name === 'return') {
          handleCustomModelSubmit();
          return;
        }
        if (key.name === 'backspace') {
          setCustomModel(customModel.slice(0, -1));
          return;
        }
        if (key.name === 'space') {
          setCustomModel(customModel + ' ');
          return;
        }
        if (key.ctrl || key.meta) return;
        if (key.sequence && key.sequence.length === 1) {
          setCustomModel(customModel + key.sequence);
        }
      }
    },
    { isActive: true },
  );

  const mainOptions = useMemo(() => {
    const authType = config?.getContentGeneratorConfig()?.authType;

    // If using OpenAI or Zhipu, allow editing the model
    if (authType === AuthType.OPENAI || authType === AuthType.ZHIPU) {
      const providerName = authType === AuthType.ZHIPU ? 'Zhipu AI' : 'OpenAI';
      const currentModel = config?.getModel() || 'Not set';

      return [
        {
          value: currentModel,
          title: `${providerName}: ${currentModel}`,
          description: `Current model. Select to keep using ${currentModel}.`,
          key: currentModel,
        },
        {
          value: 'custom',
          title: 'Change Model',
          description: `Enter a different ${providerName} model name`,
          key: 'custom',
        },
      ];
    }

    // For Gemini: Show only Gemini 3 models
    const list = [
      {
        value: PREVIEW_GEMINI_MODEL_AUTO,
        title: 'Auto (Gemini 3)',
        description: 'Automatically selects the best model',
        key: PREVIEW_GEMINI_MODEL_AUTO,
      },
      {
        value: PREVIEW_GEMINI_MODEL,
        title: 'Gemini 3 Pro',
        description: 'High capability model for complex tasks',
        key: PREVIEW_GEMINI_MODEL,
      },
      {
        value: PREVIEW_GEMINI_FLASH_MODEL,
        title: 'Gemini 3 Flash',
        description: 'Fast and efficient model',
        key: PREVIEW_GEMINI_FLASH_MODEL,
      },
      {
        value: 'custom',
        title: 'Custom Model',
        description: 'Enter a custom model name',
        key: 'custom',
      },
    ];

    return list;
  }, [config]);

  const options = mainOptions;

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(() => {
    const idx = options.findIndex((option) => option.value === preferredModel);
    return idx !== -1 ? idx : 0;
  }, [preferredModel, options]);

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (model === 'custom') {
        setShowCustomInput(true);
        return;
      }
      if (config) {
        config.setModel(model);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose],
  );

  const handleCustomModelSubmit = useCallback(() => {
    if (customModel.trim() && config) {
      const trimmedModel = customModel.trim();
      config.setModel(trimmedModel);

      // If using OpenAI/Zhipu, also update the openaiConfig
      const authType = config.getContentGeneratorConfig()?.authType;
      if (
        (authType === AuthType.OPENAI || authType === AuthType.ZHIPU) &&
        config.openaiConfig
      ) {
        config.openaiConfig.model = trimmedModel;
      }

      const event = new ModelSlashCommandEvent(trimmedModel);
      logModelSlashCommand(config, event);
    }
    onClose();
  }, [config, onClose, customModel]);

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>

      <Box marginTop={1}>
        {showCustomInput ? (
          <Box flexDirection="column">
            <Text color={theme.text.secondary}>
              Enter custom model name (press Enter to submit, Esc to cancel):
            </Text>
            <Box>
              <Text color={theme.text.primary}>{customModel}</Text>
              <Text color={theme.text.secondary}>_</Text>
            </Box>
          </Box>
        ) : (
          <DescriptiveRadioButtonSelect
            items={options}
            onSelect={handleSelect}
            initialIndex={initialIndex}
            showNumbers={true}
          />
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          Applies to this session and future Codefly CLI sessions.
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {'> To use a specific Gemini model on startup, use the --model flag.'}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
