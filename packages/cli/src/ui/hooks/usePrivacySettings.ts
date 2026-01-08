/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { type Config } from '@codefly/codefly-core';

export interface PrivacyState {
  isLoading: boolean;
  error?: string;
  isFreeTier?: boolean;
  dataCollectionOptIn?: boolean;
}

export const usePrivacySettings = (_config: Config) => {
  // Privacy settings were related to code assist which is removed.
  // Returning defaults.
  const privacyState: PrivacyState = {
    isLoading: false,
    isFreeTier: false, // Default to paid/generic
    dataCollectionOptIn: false,
  };

  const updateDataCollectionOptIn = useCallback(async (_optIn: boolean) => {
    // No-op
  }, []);

  return {
    privacyState,
    updateDataCollectionOptIn,
  };
};
