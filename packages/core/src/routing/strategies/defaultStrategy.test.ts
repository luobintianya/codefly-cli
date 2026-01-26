/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { DefaultStrategy } from './defaultStrategy.js';
import type { RoutingContext } from '../routingStrategy.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import {
  DEFAULT_CODEFLY_MODEL,
  PREVIEW_CODEFLY_MODEL,
  PREVIEW_CODEFLY_MODEL_AUTO,
  DEFAULT_CODEFLY_MODEL_AUTO,
  CODEFLY_MODEL_ALIAS_AUTO,
  PREVIEW_CODEFLY_FLASH_MODEL,
} from '../../config/models.js';
import type { Config } from '../../config/config.js';

describe('DefaultStrategy', () => {
  it('should route to the default model when requested model is default auto', async () => {
    const strategy = new DefaultStrategy();
    const mockContext = {} as RoutingContext;
    const mockConfig = {
      getModel: vi.fn().mockReturnValue(DEFAULT_CODEFLY_MODEL_AUTO),
      getPreviewFeatures: vi.fn().mockReturnValue(false),
    } as unknown as Config;
    const mockClient = {} as BaseLlmClient;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).toEqual({
      model: DEFAULT_CODEFLY_MODEL,
      metadata: {
        source: 'default',
        latencyMs: 0,
        reasoning: `Routing to default model: ${DEFAULT_CODEFLY_MODEL}`,
      },
    });
  });

  it('should route to the preview model when requested model is preview auto', async () => {
    const strategy = new DefaultStrategy();
    const mockContext = {} as RoutingContext;
    const mockConfig = {
      getModel: vi.fn().mockReturnValue(PREVIEW_CODEFLY_MODEL_AUTO),
      getPreviewFeatures: vi.fn().mockReturnValue(false),
    } as unknown as Config;
    const mockClient = {} as BaseLlmClient;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).toEqual({
      model: PREVIEW_CODEFLY_MODEL,
      metadata: {
        source: 'default',
        latencyMs: 0,
        reasoning: `Routing to default model: ${PREVIEW_CODEFLY_MODEL}`,
      },
    });
  });

  it('should route to the preview model when requested model is auto and previewfeature is on', async () => {
    const strategy = new DefaultStrategy();
    const mockContext = {} as RoutingContext;
    const mockConfig = {
      getModel: vi.fn().mockReturnValue(CODEFLY_MODEL_ALIAS_AUTO),
      getPreviewFeatures: vi.fn().mockReturnValue(true),
    } as unknown as Config;
    const mockClient = {} as BaseLlmClient;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).toEqual({
      model: PREVIEW_CODEFLY_MODEL,
      metadata: {
        source: 'default',
        latencyMs: 0,
        reasoning: `Routing to default model: ${PREVIEW_CODEFLY_MODEL}`,
      },
    });
  });

  it('should route to the default model when requested model is auto and previewfeature is off', async () => {
    const strategy = new DefaultStrategy();
    const mockContext = {} as RoutingContext;
    const mockConfig = {
      getModel: vi.fn().mockReturnValue(CODEFLY_MODEL_ALIAS_AUTO),
      getPreviewFeatures: vi.fn().mockReturnValue(false),
    } as unknown as Config;
    const mockClient = {} as BaseLlmClient;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).toEqual({
      model: DEFAULT_CODEFLY_MODEL,
      metadata: {
        source: 'default',
        latencyMs: 0,
        reasoning: `Routing to default model: ${DEFAULT_CODEFLY_MODEL}`,
      },
    });
  });

  // this should not happen, adding the test just in case it happens.
  it('should route to the same model if it is not an auto mode', async () => {
    const strategy = new DefaultStrategy();
    const mockContext = {} as RoutingContext;
    const mockConfig = {
      getModel: vi.fn().mockReturnValue(PREVIEW_CODEFLY_FLASH_MODEL),
      getPreviewFeatures: vi.fn().mockReturnValue(false),
    } as unknown as Config;
    const mockClient = {} as BaseLlmClient;

    const decision = await strategy.route(mockContext, mockConfig, mockClient);

    expect(decision).toEqual({
      model: PREVIEW_CODEFLY_FLASH_MODEL,
      metadata: {
        source: 'default',
        latencyMs: 0,
        reasoning: `Routing to default model: ${PREVIEW_CODEFLY_FLASH_MODEL}`,
      },
    });
  });
});
