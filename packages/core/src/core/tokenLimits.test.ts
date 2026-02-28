/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { tokenLimit, DEFAULT_TOKEN_LIMIT } from './tokenLimits.js';
import {
  DEFAULT_CODEFLY_FLASH_LITE_MODEL,
  DEFAULT_CODEFLY_FLASH_MODEL,
  DEFAULT_CODEFLY_MODEL,
  PREVIEW_CODEFLY_FLASH_MODEL,
  PREVIEW_CODEFLY_MODEL,
} from '../config/models.js';
import type { Config } from '../config/config.js';

describe('tokenLimit', () => {
  it('should return the correct token limit for default models', () => {
    expect(tokenLimit(DEFAULT_CODEFLY_MODEL)).toBe(1_048_576);
    expect(tokenLimit(DEFAULT_CODEFLY_FLASH_MODEL)).toBe(1_048_576);
    expect(tokenLimit(DEFAULT_CODEFLY_FLASH_LITE_MODEL)).toBe(1_048_576);
  });

  it('should return the correct token limit for preview models', () => {
    expect(tokenLimit(PREVIEW_CODEFLY_MODEL)).toBe(1_048_576);
    expect(tokenLimit(PREVIEW_CODEFLY_FLASH_MODEL)).toBe(1_048_576);
  });

  it('should return the default token limit for an unknown model', () => {
    expect(tokenLimit('unknown-model')).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should return the default token limit if no model is provided', () => {
    // @ts-expect-error testing invalid input
    expect(tokenLimit(undefined)).toBe(DEFAULT_TOKEN_LIMIT);
  });

  it('should have the correct default token limit value', () => {
    expect(DEFAULT_TOKEN_LIMIT).toBe(1_048_576);
  });

  it('should return the user-defined limit from config if provided', () => {
    const mockConfig = {
      getOpenaiContextWindowLimit: () => 500_000,
    } as unknown as Config;
    expect(tokenLimit('any-model', mockConfig)).toBe(500_000);
  });

  it('should return 1M for GLM models if no user limit is provided', () => {
    expect(tokenLimit('glm-4-9b-chat')).toBe(1_048_576);
    expect(tokenLimit('GLM-4')).toBe(1_048_576);
  });

  it('should prioritize user limit over GLM default', () => {
    const mockConfig = {
      getOpenaiContextWindowLimit: () => 200_000,
    } as unknown as Config;
    expect(tokenLimit('glm-4', mockConfig)).toBe(200_000);
  });
});
