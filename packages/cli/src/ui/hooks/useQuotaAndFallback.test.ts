/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { renderHook } from '../../test-utils/render.js';
import { type Config, makeFakeConfig } from '@codefly/codefly-core';
import { useQuotaAndFallback } from './useQuotaAndFallback.js';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';

// Use a type alias for SpyInstance as it's not directly exported
type SpyInstance = ReturnType<typeof vi.spyOn>;

describe('useQuotaAndFallback', () => {
  let mockConfig: Config;
  let mockHistoryManager: UseHistoryManagerReturn;
  let mockSetModelSwitchedFromQuotaError: Mock;
  let setFallbackHandlerSpy: SpyInstance;

  beforeEach(() => {
    mockConfig = makeFakeConfig();

    mockHistoryManager = {
      addItem: vi.fn(),
      history: [],
      updateItem: vi.fn(),
      clearItems: vi.fn(),
      loadHistory: vi.fn(),
    };
    mockSetModelSwitchedFromQuotaError = vi.fn();

    setFallbackHandlerSpy = vi.spyOn(mockConfig, 'setFallbackModelHandler');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register a fallback handler on initialization', () => {
    renderHook(() =>
      useQuotaAndFallback({
        config: mockConfig,
        historyManager: mockHistoryManager,
        setModelSwitchedFromQuotaError: mockSetModelSwitchedFromQuotaError,
      }),
    );

    expect(setFallbackHandlerSpy).toHaveBeenCalledTimes(1);
    expect(setFallbackHandlerSpy.mock.calls[0][0]).toBeInstanceOf(Function);
  });

  it('handleProQuotaChoice should resolve immediately', async () => {
    const { result } = renderHook(() =>
      useQuotaAndFallback({
        config: mockConfig,
        historyManager: mockHistoryManager,
        setModelSwitchedFromQuotaError: mockSetModelSwitchedFromQuotaError,
      }),
    );

    await expect(
      result.current.handleProQuotaChoice(),
    ).resolves.toBeUndefined();
  });
});
