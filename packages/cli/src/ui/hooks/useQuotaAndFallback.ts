/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Config,
  type FallbackModelHandler,
  type FallbackIntent,
} from '@codefly/codefly-core';
import { useEffect } from 'react';
import { type UseHistoryManagerReturn } from './useHistoryManager.js';

interface UseQuotaAndFallbackArgs {
  config: Config;
  historyManager: UseHistoryManagerReturn;
  setModelSwitchedFromQuotaError: (value: boolean) => void;
}

export function useQuotaAndFallback({
  config,
  historyManager,
  setModelSwitchedFromQuotaError,
}: UseQuotaAndFallbackArgs) {
  // Set up Flash fallback handler
  useEffect(() => {
    const fallbackHandler: FallbackModelHandler = async (
      _failedModel,
      _fallbackModel,
      _error,
    ): Promise<FallbackIntent | null> => null;

    config.setFallbackModelHandler(fallbackHandler);
    return () => {
      config.setFallbackModelHandler(async () => null);
    };
  }, [config, historyManager, setModelSwitchedFromQuotaError]);

  return {
    handleProQuotaChoice: () => Promise.resolve(),
    proQuotaRequest: null,
  };
}
