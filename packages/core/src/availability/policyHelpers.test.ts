/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolvePolicyChain,
  buildFallbackPolicyContext,
  applyModelSelection,
} from './policyHelpers.js';
import { createDefaultPolicy } from './policyCatalog.js';
import type { Config } from '../config/config.js';
import {
  DEFAULT_CODEFLY_FLASH_LITE_MODEL,
  DEFAULT_CODEFLY_MODEL_AUTO,
  PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL,
  PREVIEW_CODEFLY_3_1_MODEL,
} from '../config/models.js';
import { AuthType } from '../core/contentGenerator.js';

const createMockConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    getUserTier: () => undefined,
    getModel: () => 'codefly-2.5-pro',
    getCodefly31LaunchedSync: () => false,
    getContentGeneratorConfig: () => ({ authType: undefined }),
    ...overrides,
  }) as unknown as Config;

describe('policyHelpers', () => {
  describe('resolvePolicyChain', () => {
    it('returns a single-model chain for a custom model', () => {
      const config = createMockConfig({
        getModel: () => 'custom-model',
      });
      const chain = resolvePolicyChain(config);
      expect(chain).toHaveLength(1);
      expect(chain[0]?.model).toBe('custom-model');
    });

    it('leaves catalog order untouched when active model already present', () => {
      const config = createMockConfig({
        getModel: () => 'codefly-2.5-pro',
      });
      const chain = resolvePolicyChain(config);
      expect(chain[0]?.model).toBe('codefly-2.5-pro');
    });

    it('returns the default chain when active model is "auto"', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_CODEFLY_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config);

      // Expect default chain [Pro, Flash]
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('codefly-2.5-pro');
      expect(chain[1]?.model).toBe('codefly-2.5-flash');
    });

    it('uses auto chain when preferred model is auto', () => {
      const config = createMockConfig({
        getModel: () => 'codefly-2.5-pro',
      });
      const chain = resolvePolicyChain(config, DEFAULT_CODEFLY_MODEL_AUTO);
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('codefly-2.5-pro');
      expect(chain[1]?.model).toBe('codefly-2.5-flash');
    });

    it('uses auto chain when configured model is auto even if preferred is concrete', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_CODEFLY_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config, 'codefly-2.5-pro');
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('codefly-2.5-pro');
      expect(chain[1]?.model).toBe('codefly-2.5-flash');
    });

    it('starts chain from preferredModel when model is "auto"', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_CODEFLY_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config, 'codefly-2.5-flash');
      expect(chain).toHaveLength(1);
      expect(chain[0]?.model).toBe('codefly-2.5-flash');
    });

    it('returns flash-lite chain when preferred model is flash-lite', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_CODEFLY_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config, DEFAULT_CODEFLY_FLASH_LITE_MODEL);
      expect(chain).toHaveLength(3);
      expect(chain[0]?.model).toBe('codefly-2.5-flash-lite');
      expect(chain[1]?.model).toBe('codefly-2.5-flash');
      expect(chain[2]?.model).toBe('codefly-2.5-pro');
    });

    it('returns flash-lite chain when configured model is flash-lite', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_CODEFLY_FLASH_LITE_MODEL,
      });
      const chain = resolvePolicyChain(config);
      expect(chain).toHaveLength(3);
      expect(chain[0]?.model).toBe('codefly-2.5-flash-lite');
      expect(chain[1]?.model).toBe('codefly-2.5-flash');
      expect(chain[2]?.model).toBe('codefly-2.5-pro');
    });

    it('wraps around the chain when wrapsAround is true', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_CODEFLY_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config, 'codefly-2.5-flash', true);
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('codefly-2.5-flash');
      expect(chain[1]?.model).toBe('codefly-2.5-pro');
    });

    it('proactively returns Codefly 2.5 chain if Codefly 3 requested but user lacks access', () => {
      const config = createMockConfig({
        getModel: () => 'auto-codefly-3',
        getHasAccessToPreviewModel: () => false,
      });
      const chain = resolvePolicyChain(config);

      // Should downgrade to [Pro 2.5, Flash 2.5]
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('codefly-2.5-pro');
      expect(chain[1]?.model).toBe('codefly-2.5-flash');
    });

    it('returns Codefly 3.1 Pro chain when launched and auto-codefly-3 requested', () => {
      const config = createMockConfig({
        getModel: () => 'auto-codefly-3',
        getCodefly31LaunchedSync: () => true,
      });
      const chain = resolvePolicyChain(config);
      expect(chain[0]?.model).toBe(PREVIEW_CODEFLY_3_1_MODEL);
      expect(chain[1]?.model).toBe('codefly-3-flash-preview');
    });

    it('returns Codefly 3.1 Pro Custom Tools chain when launched, auth is Codefly, and auto-codefly-3 requested', () => {
      const config = createMockConfig({
        getModel: () => 'auto-codefly-3',
        getCodefly31LaunchedSync: () => true,
        getContentGeneratorConfig: () => ({ authType: AuthType.USE_CODEFLY }),
      });
      const chain = resolvePolicyChain(config);
      expect(chain[0]?.model).toBe(PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL);
      expect(chain[1]?.model).toBe('codefly-3-flash-preview');
    });
  });

  describe('buildFallbackPolicyContext', () => {
    it('returns remaining candidates after the failed model', () => {
      const chain = [
        createDefaultPolicy('a'),
        createDefaultPolicy('b'),
        createDefaultPolicy('c'),
      ];
      const context = buildFallbackPolicyContext(chain, 'b');
      expect(context.failedPolicy?.model).toBe('b');
      expect(context.candidates.map((p) => p.model)).toEqual(['c']);
    });

    it('wraps around when building fallback context if wrapsAround is true', () => {
      const chain = [
        createDefaultPolicy('a'),
        createDefaultPolicy('b'),
        createDefaultPolicy('c'),
      ];
      const context = buildFallbackPolicyContext(chain, 'b', true);
      expect(context.failedPolicy?.model).toBe('b');
      expect(context.candidates.map((p) => p.model)).toEqual(['c', 'a']);
    });

    it('returns full chain when model is not in policy list', () => {
      const chain = [createDefaultPolicy('a'), createDefaultPolicy('b')];
      const context = buildFallbackPolicyContext(chain, 'x');
      expect(context.failedPolicy).toBeUndefined();
      expect(context.candidates).toEqual(chain);
    });
  });

  describe('applyModelSelection', () => {
    const mockModelConfigService = {
      getResolvedConfig: vi.fn(),
    };

    const mockAvailabilityService = {
      selectFirstAvailable: vi.fn(),
      consumeStickyAttempt: vi.fn(),
    };

    const createExtendedMockConfig = (
      overrides: Partial<Config> = {},
    ): Config => {
      const defaults = {
        getModelAvailabilityService: () => mockAvailabilityService,
        setActiveModel: vi.fn(),
        modelConfigService: mockModelConfigService,
      };
      return createMockConfig({ ...defaults, ...overrides } as Partial<Config>);
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns requested model if it is available', () => {
      const config = createExtendedMockConfig();
      mockModelConfigService.getResolvedConfig.mockReturnValue({
        model: 'codefly-pro',
        generateContentConfig: {},
      });
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'codefly-pro',
      });

      const result = applyModelSelection(config, {
        model: 'codefly-pro',
        isChatModel: true,
      });
      expect(result.model).toBe('codefly-pro');
      expect(result.maxAttempts).toBeUndefined();
      expect(config.setActiveModel).toHaveBeenCalledWith('codefly-pro');
    });

    it('switches to backup model and updates config if requested is unavailable', () => {
      const config = createExtendedMockConfig();
      mockModelConfigService.getResolvedConfig
        .mockReturnValueOnce({
          model: 'codefly-pro',
          generateContentConfig: { temperature: 0.9, topP: 1 },
        })
        .mockReturnValueOnce({
          model: 'codefly-flash',
          generateContentConfig: { temperature: 0.1, topP: 1 },
        });
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'codefly-flash',
      });

      const result = applyModelSelection(config, {
        model: 'codefly-pro',
        isChatModel: true,
      });

      expect(result.model).toBe('codefly-flash');
      expect(result.config).toEqual({
        temperature: 0.1,
        topP: 1,
      });

      expect(mockModelConfigService.getResolvedConfig).toHaveBeenCalledWith({
        model: 'codefly-pro',
        isChatModel: true,
      });
      expect(mockModelConfigService.getResolvedConfig).toHaveBeenCalledWith({
        model: 'codefly-flash',
        isChatModel: true,
      });
      expect(config.setActiveModel).toHaveBeenCalledWith('codefly-flash');
    });

    it('does not call setActiveModel if isChatModel is false', () => {
      const config = createExtendedMockConfig();
      mockModelConfigService.getResolvedConfig.mockReturnValue({
        model: 'codefly-pro',
        generateContentConfig: {},
      });
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'codefly-pro',
      });

      applyModelSelection(config, {
        model: 'codefly-pro',
        isChatModel: false,
      });
      expect(config.setActiveModel).not.toHaveBeenCalled();
    });

    it('consumes sticky attempt if indicated and isChatModel is true', () => {
      const config = createExtendedMockConfig();
      mockModelConfigService.getResolvedConfig.mockReturnValue({
        model: 'codefly-pro',
        generateContentConfig: {},
      });
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'codefly-pro',
        attempts: 1,
      });

      const result = applyModelSelection(config, {
        model: 'codefly-pro',
        isChatModel: true,
      });
      expect(mockAvailabilityService.consumeStickyAttempt).toHaveBeenCalledWith(
        'codefly-pro',
      );
      expect(config.setActiveModel).toHaveBeenCalledWith('codefly-pro');
      expect(result.maxAttempts).toBe(1);
    });

    it('consumes sticky attempt if indicated but does not call setActiveModel if isChatModel is false', () => {
      const config = createExtendedMockConfig();
      mockModelConfigService.getResolvedConfig.mockReturnValue({
        model: 'codefly-pro',
        generateContentConfig: {},
      });
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'codefly-pro',
        attempts: 1,
      });

      const result = applyModelSelection(config, {
        model: 'codefly-pro',
        isChatModel: false,
      });
      expect(mockAvailabilityService.consumeStickyAttempt).toHaveBeenCalledWith(
        'codefly-pro',
      );
      expect(config.setActiveModel).not.toHaveBeenCalled();
      expect(result.maxAttempts).toBe(1);
    });

    it('does not consume sticky attempt if consumeAttempt is false', () => {
      const config = createExtendedMockConfig();
      mockModelConfigService.getResolvedConfig.mockReturnValue({
        model: 'codefly-pro',
        generateContentConfig: {},
      });
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'codefly-pro',
        attempts: 1,
      });

      const result = applyModelSelection(
        config,
        { model: 'codefly-pro', isChatModel: true },
        {
          consumeAttempt: false,
        },
      );
      expect(
        mockAvailabilityService.consumeStickyAttempt,
      ).not.toHaveBeenCalled();
      expect(config.setActiveModel).toHaveBeenCalledWith('codefly-pro');
      expect(result.maxAttempts).toBe(1);
    });
  });
});
