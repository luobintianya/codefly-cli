/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  resolveModel,
  resolveClassifierModel,
  isCodefly2Model,
  isAutoModel,
  getDisplayString,
  DEFAULT_CODEFLY_MODEL,
  PREVIEW_CODEFLY_MODEL,
  DEFAULT_CODEFLY_FLASH_MODEL,
  DEFAULT_CODEFLY_FLASH_LITE_MODEL,
  supportsMultimodalFunctionResponse,
  CODEFLY_MODEL_ALIAS_PRO,
  CODEFLY_MODEL_ALIAS_FLASH,
  CODEFLY_MODEL_ALIAS_FLASH_LITE,
  CODEFLY_MODEL_ALIAS_AUTO,
  PREVIEW_CODEFLY_FLASH_MODEL,
  PREVIEW_CODEFLY_MODEL_AUTO,
  DEFAULT_CODEFLY_MODEL_AUTO,
} from './models.js';

describe('isPreviewModel', () => {
  it('should return true for preview models', () => {
    expect(isPreviewModel(PREVIEW_CODEFLY_MODEL)).toBe(true);
    expect(isPreviewModel(PREVIEW_CODEFLY_3_1_MODEL)).toBe(true);
    expect(isPreviewModel(PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL)).toBe(true);
    expect(isPreviewModel(PREVIEW_CODEFLY_FLASH_MODEL)).toBe(true);
    expect(isPreviewModel(PREVIEW_CODEFLY_MODEL_AUTO)).toBe(true);
  });

  it('should return false for non-preview models', () => {
    expect(isPreviewModel(DEFAULT_CODEFLY_MODEL)).toBe(false);
    expect(isPreviewModel('codefly-1.5-pro')).toBe(false);
  });
});

describe('isProModel', () => {
  it('should return true for models containing "pro"', () => {
    expect(isProModel('codefly-3-pro-preview')).toBe(true);
    expect(isProModel('codefly-2.5-pro')).toBe(true);
    expect(isProModel('pro')).toBe(true);
  });

  it('should return false for models without "pro"', () => {
    expect(isProModel('codefly-3-flash-preview')).toBe(false);
    expect(isProModel('codefly-2.5-flash')).toBe(false);
    expect(isProModel('auto')).toBe(false);
  });
});

describe('isCustomModel', () => {
  it('should return true for models not starting with codefly-', () => {
    expect(isCustomModel('testing')).toBe(true);
    expect(isCustomModel('gpt-4')).toBe(true);
    expect(isCustomModel('claude-3')).toBe(true);
  });

  it('should return false for Codefly models', () => {
    expect(isCustomModel('codefly-1.5-pro')).toBe(false);
    expect(isCustomModel('codefly-2.0-flash')).toBe(false);
    expect(isCustomModel('codefly-3-pro-preview')).toBe(false);
  });

  it('should return false for aliases that resolve to Codefly models', () => {
    expect(isCustomModel(CODEFLY_MODEL_ALIAS_AUTO)).toBe(false);
    expect(isCustomModel(CODEFLY_MODEL_ALIAS_PRO)).toBe(false);
  });
});

describe('supportsModernFeatures', () => {
  it('should return true for Codefly 3 models', () => {
    expect(supportsModernFeatures('codefly-3-pro-preview')).toBe(true);
    expect(supportsModernFeatures('codefly-3-flash-preview')).toBe(true);
  });

  it('should return true for custom models', () => {
    expect(supportsModernFeatures('testing')).toBe(true);
    expect(supportsModernFeatures('some-custom-model')).toBe(true);
  });

  it('should return false for older Codefly models', () => {
    expect(supportsModernFeatures('codefly-2.5-pro')).toBe(false);
    expect(supportsModernFeatures('codefly-2.5-flash')).toBe(false);
    expect(supportsModernFeatures('codefly-2.0-flash')).toBe(false);
    expect(supportsModernFeatures('codefly-1.5-pro')).toBe(false);
    expect(supportsModernFeatures('codefly-1.0-pro')).toBe(false);
  });

  it('should return true for modern aliases', () => {
    expect(supportsModernFeatures(CODEFLY_MODEL_ALIAS_PRO)).toBe(true);
    expect(supportsModernFeatures(CODEFLY_MODEL_ALIAS_AUTO)).toBe(true);
  });
});

describe('isCodefly3Model', () => {
  it('should return true for codefly-3 models', () => {
    expect(isCodefly3Model('codefly-3-pro-preview')).toBe(true);
    expect(isCodefly3Model('codefly-3-flash-preview')).toBe(true);
  });

  it('should return true for aliases that resolve to Codefly 3', () => {
    expect(isCodefly3Model(CODEFLY_MODEL_ALIAS_AUTO)).toBe(true);
    expect(isCodefly3Model(CODEFLY_MODEL_ALIAS_PRO)).toBe(true);
    expect(isCodefly3Model(PREVIEW_CODEFLY_MODEL_AUTO)).toBe(true);
  });

  it('should return false for Codefly 2 models', () => {
    expect(isCodefly3Model('codefly-2.5-pro')).toBe(false);
    expect(isCodefly3Model('codefly-2.5-flash')).toBe(false);
    expect(isCodefly3Model(DEFAULT_CODEFLY_MODEL_AUTO)).toBe(false);
  });

  it('should return false for arbitrary strings', () => {
    expect(isCodefly3Model('gpt-4')).toBe(false);
  });
});

describe('getDisplayString', () => {
  it('should return Auto (Codefly 3) for preview auto model', () => {
    expect(getDisplayString(PREVIEW_CODEFLY_MODEL_AUTO)).toBe(
      'Auto (Codefly 3)',
    );
  });

  it('should return Auto (Codefly 2.5) for default auto model', () => {
    expect(getDisplayString(DEFAULT_CODEFLY_MODEL_AUTO)).toBe(
      'Auto (Codefly 3)',
    );
  });

  it('should return concrete model name for pro alias', () => {
    expect(getDisplayString(CODEFLY_MODEL_ALIAS_PRO, false)).toBe(
      DEFAULT_CODEFLY_MODEL,
    );
    expect(getDisplayString(CODEFLY_MODEL_ALIAS_PRO, true)).toBe(
      PREVIEW_CODEFLY_MODEL,
    );
  });

  it('should return concrete model name for flash alias', () => {
    expect(getDisplayString(CODEFLY_MODEL_ALIAS_FLASH, false)).toBe(
      DEFAULT_CODEFLY_FLASH_MODEL,
    );
    expect(getDisplayString(CODEFLY_MODEL_ALIAS_FLASH, true)).toBe(
      PREVIEW_CODEFLY_FLASH_MODEL,
    );
  });

  it('should return PREVIEW_CODEFLY_3_1_MODEL for PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL', () => {
    expect(getDisplayString(PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL)).toBe(
      PREVIEW_CODEFLY_3_1_MODEL,
    );
  });

  it('should return the model name as is for other models', () => {
    expect(getDisplayString('custom-model')).toBe('custom-model');
    expect(getDisplayString(DEFAULT_CODEFLY_FLASH_LITE_MODEL)).toBe(
      DEFAULT_CODEFLY_FLASH_LITE_MODEL,
    );
  });
});

describe('supportsMultimodalFunctionResponse', () => {
  it('should return true for codefly-3 model', () => {
    expect(supportsMultimodalFunctionResponse('codefly-3-pro')).toBe(true);
  });

  it('should return false for codefly-2 models', () => {
    expect(supportsMultimodalFunctionResponse('codefly-2.5-pro')).toBe(false);
    expect(supportsMultimodalFunctionResponse('codefly-2.5-flash')).toBe(false);
  });

  it('should return false for other models', () => {
    expect(supportsMultimodalFunctionResponse('some-other-model')).toBe(false);
    expect(supportsMultimodalFunctionResponse('')).toBe(false);
  });
});

describe('resolveModel', () => {
  describe('delegation logic', () => {
    it('should return the Preview Pro model when auto-codefly-3 is requested', () => {
      const model = resolveModel(PREVIEW_CODEFLY_MODEL_AUTO, false);
      expect(model).toBe(PREVIEW_CODEFLY_MODEL);
    });

    it('should return the Default Pro model when auto-codefly-3 is requested as default', () => {
      const model = resolveModel(DEFAULT_CODEFLY_MODEL_AUTO, false);
      expect(model).toBe(PREVIEW_CODEFLY_MODEL);
    });

    it('should return the requested model as-is for explicit specific models', () => {
      expect(resolveModel(DEFAULT_CODEFLY_MODEL, false)).toBe(
        DEFAULT_CODEFLY_MODEL,
      );
      expect(resolveModel(DEFAULT_CODEFLY_FLASH_MODEL, false)).toBe(
        DEFAULT_CODEFLY_FLASH_MODEL,
      );
      expect(resolveModel(DEFAULT_CODEFLY_FLASH_LITE_MODEL)).toBe(
        DEFAULT_CODEFLY_FLASH_LITE_MODEL,
      );
    });

    it('should return a custom model name when requested', () => {
      const customModel = 'custom-model-v1';
      const model = resolveModel(customModel);
      expect(model).toBe(customModel);
    });

    describe('with preview features', () => {
      it('should return the preview model when pro alias is requested', () => {
        const model = resolveModel(CODEFLY_MODEL_ALIAS_PRO, true);
        expect(model).toBe(PREVIEW_CODEFLY_MODEL);
      });

      it('should return the default pro model when pro alias is requested and preview is off', () => {
        const model = resolveModel(CODEFLY_MODEL_ALIAS_PRO, false);
        expect(model).toBe(DEFAULT_CODEFLY_MODEL);
      });

      it('should return the flash model when flash is requested and preview is on', () => {
        const model = resolveModel(CODEFLY_MODEL_ALIAS_FLASH, true);
        expect(model).toBe(PREVIEW_CODEFLY_FLASH_MODEL);
      });

      it('should return the flash model when lite is requested and preview is on', () => {
        const model = resolveModel(CODEFLY_MODEL_ALIAS_FLASH_LITE, true);
        expect(model).toBe(DEFAULT_CODEFLY_FLASH_LITE_MODEL);
      });

      it('should return the flash model when the flash model name is explicitly requested and preview is on', () => {
        const model = resolveModel(DEFAULT_CODEFLY_FLASH_MODEL, true);
        expect(model).toBe(DEFAULT_CODEFLY_FLASH_MODEL);
      });

      it('should return the lite model when the lite model name is requested and preview is on', () => {
        const model = resolveModel(DEFAULT_CODEFLY_FLASH_LITE_MODEL, true);
        expect(model).toBe(DEFAULT_CODEFLY_FLASH_LITE_MODEL);
      });

      it('should return the default codefly model when the model is explicitly set and preview is on', () => {
        const model = resolveModel(DEFAULT_CODEFLY_MODEL, true);
        expect(model).toBe(DEFAULT_CODEFLY_MODEL);
      });
    });
  });
});

describe('isCodefly2Model', () => {
  it('should return true for codefly-2.5-pro', () => {
    expect(isCodefly2Model('codefly-2.5-pro')).toBe(true);
  });

  it('should return true for codefly-2.5-flash', () => {
    expect(isCodefly2Model('codefly-2.5-flash')).toBe(true);
  });

  it('should return true for codefly-2.0-flash', () => {
    expect(isCodefly2Model('codefly-2.0-flash')).toBe(true);
  });

  it('should return false for codefly-1.5-pro', () => {
    expect(isCodefly2Model('codefly-1.5-pro')).toBe(false);
  });

  it('should return false for codefly-3-pro', () => {
    expect(isCodefly2Model('codefly-3-pro')).toBe(false);
  });

  it('should return false for arbitrary strings', () => {
    expect(isCodefly2Model('gpt-4')).toBe(false);
  });
});

describe('isAutoModel', () => {
  it('should return true for "auto"', () => {
    expect(isAutoModel(CODEFLY_MODEL_ALIAS_AUTO)).toBe(true);
  });

  it('should return true for "auto-codefly-3"', () => {
    expect(isAutoModel(PREVIEW_CODEFLY_MODEL_AUTO)).toBe(true);
  });

  it('should return true for "auto-codefly-2.5"', () => {
    expect(isAutoModel(DEFAULT_CODEFLY_MODEL_AUTO)).toBe(true);
  });

  it('should return false for concrete models', () => {
    expect(isAutoModel(DEFAULT_CODEFLY_MODEL)).toBe(false);
    expect(isAutoModel(PREVIEW_CODEFLY_MODEL)).toBe(false);
    expect(isAutoModel('some-random-model')).toBe(false);
  });
});

describe('resolveClassifierModel', () => {
  it('should return flash model when alias is flash', () => {
    expect(
      resolveClassifierModel(
        DEFAULT_CODEFLY_MODEL_AUTO,
        CODEFLY_MODEL_ALIAS_FLASH,
      ),
    ).toBe(DEFAULT_CODEFLY_FLASH_MODEL);
    expect(
      resolveClassifierModel(
        PREVIEW_CODEFLY_MODEL_AUTO,
        CODEFLY_MODEL_ALIAS_FLASH,
      ),
    ).toBe(PREVIEW_CODEFLY_FLASH_MODEL);
  });

  it('should return pro model when alias is pro', () => {
    expect(
      resolveClassifierModel(
        DEFAULT_CODEFLY_MODEL_AUTO,
        CODEFLY_MODEL_ALIAS_PRO,
      ),
    ).toBe(PREVIEW_CODEFLY_MODEL);
    expect(
      resolveClassifierModel(
        PREVIEW_CODEFLY_MODEL_AUTO,
        CODEFLY_MODEL_ALIAS_PRO,
      ),
    ).toBe(PREVIEW_CODEFLY_MODEL);
  });

  it('should handle preview features being enabled', () => {
    // If preview is enabled, resolving 'flash' without context (fallback) might switch to preview flash,
    // but here we test explicit auto models which should stick to their families if possible?
    // Actually our logic forces DEFAULT_CODEFLY_FLASH_MODEL for DEFAULT_CODEFLY_MODEL_AUTO even if preview is on,
    // because the USER requested 2.5 explicitly via "auto-codefly-2.5".
    expect(
      resolveClassifierModel(
        DEFAULT_CODEFLY_MODEL_AUTO,
        CODEFLY_MODEL_ALIAS_FLASH,
        true,
      ),
    ).toBe(DEFAULT_CODEFLY_FLASH_MODEL);
  });
});
