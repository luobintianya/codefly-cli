/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_CODEFLY_FLASH_LITE_MODEL,
  DEFAULT_CODEFLY_FLASH_MODEL,
  DEFAULT_CODEFLY_MODEL,
  PREVIEW_CODEFLY_FLASH_MODEL,
  PREVIEW_CODEFLY_MODEL,
} from '../config/models.js';

import type { Config } from '../config/config.js';

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;

export function tokenLimit(model: Model, config?: Config): TokenCount {
  // If user has provided an explicit limit for OpenAI-compatible models, use it.
  const userLimit = config?.getOpenaiContextWindowLimit();
  if (userLimit && userLimit > 0) {
    return userLimit;
  }

  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/codefly-api/docs/models
  switch (model) {
    case PREVIEW_CODEFLY_MODEL:
    case PREVIEW_CODEFLY_FLASH_MODEL:
    case DEFAULT_CODEFLY_MODEL:
    case DEFAULT_CODEFLY_FLASH_MODEL:
    case DEFAULT_CODEFLY_FLASH_LITE_MODEL:
      return 1_048_576;
    default:
      // Special case for GLM models which are often used in OpenAI compatible mode
      if (model && model.toLowerCase().includes('glm-4')) {
        // GLM-4 standard is 128k, but some variants are larger.
        // We'll use 1M as a safe default if not specified, but this allows for future tuning.
        return 1_048_576;
      }
      return DEFAULT_TOKEN_LIMIT;
  }
}
