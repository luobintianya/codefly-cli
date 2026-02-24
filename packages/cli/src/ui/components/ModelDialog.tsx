/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  PREVIEW_CODEFLY_MODEL,
  PREVIEW_CODEFLY_FLASH_MODEL,
  PREVIEW_CODEFLY_MODEL_AUTO,
  DEFAULT_CODEFLY_MODEL,
  DEFAULT_CODEFLY_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_CODEFLY_MODEL_AUTO,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  getDisplayString,
} from '@codeflyai/codefly-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import {
  DescriptiveRadioButtonSelect,
  type DescriptiveRadioSelectItem,
} from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { ThemedGradient } from './ThemedGradient.js';

interface ModelDialogProps {
  onClose: () => void;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const settings = useSettings();
  const [view, setView] = useState<'main' | 'manual'>('main');
  const [persistMode, setPersistMode] = useState(true);
  const settings = useSettings();

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || DEFAULT_CODEFLY_MODEL_AUTO;

  const shouldShowPreviewModels = config?.getHasAccessToPreviewModel();
  const useGemini31 = config?.getGemini31LaunchedSync?.() ?? false;
  const selectedAuthType = settings.merged.security.auth.selectedType;
  const useCustomToolModel =
    useGemini31 && selectedAuthType === AuthType.USE_GEMINI;

  const manualModelSelected = useMemo(() => {
    const manualModels = [
      DEFAULT_CODEFLY_MODEL,
      DEFAULT_CODEFLY_FLASH_MODEL,
      DEFAULT_GEMINI_FLASH_LITE_MODEL,
      PREVIEW_CODEFLY_MODEL,
      PREVIEW_CODEFLY_FLASH_MODEL,
    ];
    if (manualModels.includes(preferredModel)) {
      return preferredModel;
    }
    return '';
  }, [preferredModel]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (view === 'manual') {
          setView('main');
        } else {
          onClose();
        }
        return true;
      }
      if (key.name === 'tab') {
        setPersistMode((prev) => !prev);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  const mainOptions = useMemo(() => {
    const list = [
      {
        value: DEFAULT_CODEFLY_MODEL_AUTO,
        title: getDisplayString(DEFAULT_CODEFLY_MODEL_AUTO),
        description:
          'Let Codefly CLI decide the best model for the task: gemini-2.5-pro, gemini-2.5-flash',
        key: DEFAULT_CODEFLY_MODEL_AUTO,
      },
      {
        value: PREVIEW_CODEFLY_MODEL,
        title: getDisplayString(PREVIEW_CODEFLY_MODEL),
        description: 'Gemini 3 Pro (Preview)',
        key: PREVIEW_CODEFLY_MODEL,
      },
      {
        value: PREVIEW_CODEFLY_FLASH_MODEL,
        title: getDisplayString(PREVIEW_CODEFLY_FLASH_MODEL),
        description: 'Gemini 3 Flash (Preview)',
        key: PREVIEW_CODEFLY_FLASH_MODEL,
      },
      {
        value: 'Manual',
        title: manualModelSelected
          ? `Manual (${getDisplayString(manualModelSelected)})`
          : 'Manual',
        description: 'Manually select a model',
        key: 'Manual',
      },
    ];

    if (
      shouldShowPreviewModels &&
      PREVIEW_CODEFLY_MODEL_AUTO !== DEFAULT_CODEFLY_MODEL_AUTO
    ) {
      list.unshift({
        value: PREVIEW_CODEFLY_MODEL_AUTO,
        title: getDisplayString(PREVIEW_CODEFLY_MODEL_AUTO),
        description:
          'Let Codefly CLI decide the best model for the task: gemini-3-pro, gemini-3-flash',
        key: PREVIEW_CODEFLY_MODEL_AUTO,
      });
    }
    return list;
  }, [shouldShowPreviewModels, manualModelSelected, useGemini31]);

  const manualOptions = useMemo(() => {
    const list: Array<DescriptiveRadioSelectItem<string>> = [];

    // --- Google / Gemini ---
    list.push({
      value: 'header-google',
      title: 'Google / Gemini',
      key: 'header-google',
      isHeader: true,
    });

    if (shouldShowPreviewModels) {
      list.push(
        {
          value: PREVIEW_CODEFLY_MODEL,
          title: PREVIEW_CODEFLY_MODEL,
          key: PREVIEW_CODEFLY_MODEL,
        },
        {
          value: PREVIEW_CODEFLY_FLASH_MODEL,
          title: PREVIEW_CODEFLY_FLASH_MODEL,
          key: PREVIEW_CODEFLY_FLASH_MODEL,
        },
      );
    }

    list.push(
      {
        value: DEFAULT_CODEFLY_MODEL,
        title: DEFAULT_CODEFLY_MODEL,
        key: DEFAULT_CODEFLY_MODEL,
      },
      {
        value: DEFAULT_CODEFLY_FLASH_MODEL,
        title: DEFAULT_CODEFLY_FLASH_MODEL,
        key: DEFAULT_CODEFLY_FLASH_MODEL,
      },
      {
        value: DEFAULT_GEMINI_FLASH_LITE_MODEL,
        title: getDisplayString(DEFAULT_GEMINI_FLASH_LITE_MODEL),
        key: DEFAULT_GEMINI_FLASH_LITE_MODEL,
      },
    );

    // --- OpenAI Compatible ---
    const openaiConfig = settings.merged.security.auth.openai;
    if (openaiConfig?.models) {
      const openaiModels = openaiConfig.models
        .split(',')
        .map((m: string) => m.trim())
        .filter((m: string) => m.length > 0);
      if (openaiModels.length > 0) {
        list.push({
          value: 'header-openai',
          title: 'OpenAI Compatible',
          key: 'header-openai',
          isHeader: true,
        });
        list.push(
          ...openaiModels.map((m: string) => ({
            value: m,
            title: m,
            key: `openai-${m}`,
          })),
        );
      }
    }

    return list;
  }, [shouldShowPreviewModels, settings]);

  const options = view === 'main' ? mainOptions : manualOptions;

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(() => {
    const idx = options.findIndex((option) => option.value === preferredModel);
    if (idx !== -1) {
      return idx;
    }
    if (view === 'main') {
      const manualIdx = options.findIndex((o) => o.value === 'Manual');
      return manualIdx !== -1 ? manualIdx : 0;
    }
    return 0;
  }, [preferredModel, options, view]);

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (model === 'Manual') {
        setView('manual');
        return;
      }

      if (config) {
        void config.setModel(model, persistMode ? false : true);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose, persistMode],
  );

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
        <DescriptiveRadioButtonSelect
          items={options}
          onSelect={handleSelect}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.text.primary}>
            Remember model for future sessions:{' '}
          </Text>
          <Text color={theme.status.success}>
            {persistMode ? 'true' : 'false'}
          </Text>
        </Box>
        <Text color={theme.text.secondary}>(Press Tab to toggle)</Text>
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
