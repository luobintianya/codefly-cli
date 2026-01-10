/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '../../test-utils/render.js';
import type { Config } from '@codeflyai/codefly-core';
import { usePrivacySettings } from './usePrivacySettings.js';
import { waitFor } from '../../test-utils/async.js';

describe('usePrivacySettings', () => {
  const mockConfig = {} as unknown as Config;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPrivacySettingsHook = () => {
    let hookResult: ReturnType<typeof usePrivacySettings>;
    function TestComponent() {
      hookResult = usePrivacySettings(mockConfig);
      return null;
    }
    render(<TestComponent />);
    return {
      result: {
        get current() {
          return hookResult;
        },
      },
    };
  };

  it('should initialize with default values', async () => {
    const { result } = renderPrivacySettingsHook();

    await waitFor(() => {
      expect(result.current.privacyState.isLoading).toBe(false);
    });

    expect(result.current.privacyState.error).toBeUndefined();
    // Assuming default behavior without CodeAssist is basic
  });
});
