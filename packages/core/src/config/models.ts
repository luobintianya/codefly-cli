/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const PREVIEW_CODEFLY_MODEL = 'codefly-3-pro-preview';
export const PREVIEW_CODEFLY_FLASH_MODEL = 'codefly-3-flash-preview';
export const PREVIEW_CODEFLY_3_1_MODEL = 'codefly-3.1-pro-preview';
export const PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL =
  'codefly-3.1-pro-preview-custom-tools';
// Keep Codefly 2.x constants for backwards compatibility but use Codefly 3 Pro as default
export const DEFAULT_CODEFLY_MODEL = PREVIEW_CODEFLY_MODEL; // Default to Pro
export const DEFAULT_CODEFLY_FLASH_MODEL = PREVIEW_CODEFLY_FLASH_MODEL;
// Codefly 2.x legacy constants (deprecated)
export const LEGACY_CODEFLY_2_5_PRO = 'codefly-2.5-pro';
export const LEGACY_CODEFLY_2_5_FLASH = 'codefly-2.5-flash';
export const DEFAULT_CODEFLY_FLASH_LITE_MODEL = 'codefly-2.5-flash-lite';
// Gemini aliases for backwards compatibility

export const VALID_CODEFLY_MODELS = new Set([
  PREVIEW_CODEFLY_MODEL,
  PREVIEW_CODEFLY_FLASH_MODEL,
  LEGACY_CODEFLY_2_5_PRO,
  LEGACY_CODEFLY_2_5_FLASH,
  DEFAULT_CODEFLY_FLASH_LITE_MODEL,
]);

export const PREVIEW_CODEFLY_MODEL_AUTO = 'auto-codefly-3';
export const DEFAULT_CODEFLY_MODEL_AUTO = 'auto-codefly-3';
// Gemini aliases for backwards compatibility
/** @deprecated Use DEFAULT_CODEFLY_MODEL */
export const DEFAULT_GEMINI_MODEL = DEFAULT_CODEFLY_MODEL;
/** @deprecated Use DEFAULT_CODEFLY_FLASH_MODEL */
export const DEFAULT_GEMINI_FLASH_MODEL = DEFAULT_CODEFLY_FLASH_MODEL;
/** @deprecated Use DEFAULT_CODEFLY_FLASH_LITE_MODEL */
export const DEFAULT_GEMINI_FLASH_LITE_MODEL = DEFAULT_CODEFLY_FLASH_LITE_MODEL;
/** @deprecated Use PREVIEW_CODEFLY_MODEL */
export const PREVIEW_GEMINI_MODEL = PREVIEW_CODEFLY_MODEL;
/** @deprecated Use PREVIEW_CODEFLY_FLASH_MODEL */
export const PREVIEW_GEMINI_FLASH_MODEL = PREVIEW_CODEFLY_FLASH_MODEL;
/** @deprecated Use PREVIEW_CODEFLY_MODEL_AUTO */
export const PREVIEW_GEMINI_MODEL_AUTO = PREVIEW_CODEFLY_MODEL_AUTO;
/** @deprecated Use PREVIEW_CODEFLY_3_1_MODEL */
export const PREVIEW_GEMINI_3_1_MODEL = PREVIEW_CODEFLY_3_1_MODEL;
/** @deprecated Use LEGACY_CODEFLY_2_5_PRO */
export const LEGACY_GEMINI_2_5_PRO = LEGACY_CODEFLY_2_5_PRO;
/** @deprecated Use LEGACY_CODEFLY_2_5_FLASH */
export const LEGACY_GEMINI_2_5_FLASH = LEGACY_CODEFLY_2_5_FLASH;

// Model aliases for user convenience.
export const CODEFLY_MODEL_ALIAS_AUTO = 'auto';
export const CODEFLY_MODEL_ALIAS_PRO = 'pro';
export const CODEFLY_MODEL_ALIAS_FLASH = 'flash';
export const CODEFLY_MODEL_ALIAS_FLASH_LITE = 'flash-lite';

export const DEFAULT_CODEFLY_EMBEDDING_MODEL = 'codefly-embedding-001';

// Thinking mode configuration

// Cap the thinking at 8192 to prevent run-away thinking loops.
export const DEFAULT_THINKING_MODE = 8192;

/**
 * Resolves the requested model alias (e.g., 'auto-codefly-3', 'pro', 'flash', 'flash-lite')
 * to a concrete model name.
 *
 * @param requestedModel The model alias or concrete model name requested by the user.
 * @param useCodefly3_1 Whether to use Codefly 3.1 Pro Preview for auto/pro aliases.
 * @returns The resolved concrete model name.
 */
export function resolveModel(
  requestedModel: string,
  useCodefly3_1: boolean = false,
  _useCustomToolModel: boolean = false,
): string {
  switch (requestedModel) {
    case PREVIEW_CODEFLY_MODEL_AUTO: {
      return PREVIEW_CODEFLY_MODEL; // Auto uses Pro by default for Codefly 3
    }
    case DEFAULT_CODEFLY_MODEL_AUTO: {
      return PREVIEW_CODEFLY_MODEL; // Auto uses Pro by default for Codefly 3
    }
    case CODEFLY_MODEL_ALIAS_AUTO:
    case CODEFLY_MODEL_ALIAS_PRO: {
      return useCodefly3_1 ? PREVIEW_CODEFLY_MODEL : DEFAULT_CODEFLY_MODEL;
    }
    case CODEFLY_MODEL_ALIAS_FLASH: {
      return useCodefly3_1
        ? PREVIEW_CODEFLY_FLASH_MODEL
        : DEFAULT_CODEFLY_FLASH_MODEL;
    }
    case CODEFLY_MODEL_ALIAS_FLASH_LITE: {
      return DEFAULT_CODEFLY_FLASH_LITE_MODEL;
    }
    default: {
      return requestedModel;
    }
  }
}

/**
 * Resolves the appropriate model based on the classifier's decision.
 *
 * @param requestedModel The current requested model (e.g. auto-codefly-2.5).
 * @param modelAlias The alias selected by the classifier ('flash' or 'pro').
 * @returns The resolved concrete model name.
 */
export function resolveClassifierModel(
  requestedModel: string,
  modelAlias: string,
  useCodefly3_1: boolean = false,
  useCustomToolModel: boolean = false,
): string {
  if (modelAlias === CODEFLY_MODEL_ALIAS_FLASH) {
    if (
      requestedModel === DEFAULT_CODEFLY_MODEL_AUTO ||
      requestedModel === DEFAULT_CODEFLY_MODEL
    ) {
      return DEFAULT_CODEFLY_FLASH_MODEL;
    }
    if (
      requestedModel === PREVIEW_CODEFLY_MODEL_AUTO ||
      requestedModel === PREVIEW_CODEFLY_MODEL
    ) {
      return PREVIEW_CODEFLY_FLASH_MODEL;
    }
    return resolveModel(CODEFLY_MODEL_ALIAS_FLASH, useCodefly3_1);
  }
  return resolveModel(requestedModel, useCodefly3_1, useCustomToolModel);
}
export function getDisplayString(
  model: string,
  useCodefly3_1: boolean = false,
) {
  switch (model) {
    case PREVIEW_CODEFLY_MODEL_AUTO:
      return 'Auto (Codefly 3)';
    case DEFAULT_CODEFLY_MODEL_AUTO:
      return 'Auto (Codefly 2.5)';
    case CODEFLY_MODEL_ALIAS_PRO:
      return useCodefly3_1 ? PREVIEW_CODEFLY_MODEL : DEFAULT_CODEFLY_MODEL;
    case CODEFLY_MODEL_ALIAS_FLASH:
      return useCodefly3_1
        ? PREVIEW_CODEFLY_FLASH_MODEL
        : DEFAULT_CODEFLY_FLASH_MODEL;
    default:
      return model;
  }
}

/**
 * Checks if the model is a preview model.
 *
 * @param model The model name to check.
 * @returns True if the model is a preview model.
 */
export function isPreviewModel(model: string): boolean {
  return (
    model === PREVIEW_CODEFLY_MODEL ||
    model === PREVIEW_CODEFLY_FLASH_MODEL ||
    model === PREVIEW_CODEFLY_MODEL_AUTO
  );
}

/**
 * Checks if the model is a Pro model.
 *
 * @param model The model name to check.
 * @returns True if the model is a Pro model.
 */
export function isProModel(model: string): boolean {
  return model.toLowerCase().includes('pro');
}

/**
 * Checks if the model is a Codefly 3 model.
 *
 * @param model The model name to check.
 * @returns True if the model is a Codefly 3 model.
 */
export function isCodefly3Model(model: string): boolean {
  const resolved = resolveModel(model);
  return /^codefly-3(\.|-|$)/.test(resolved);
}
/** @deprecated Use isCodefly3Model */
export const isGemini3Model = isCodefly3Model;

/**
 * Checks if the model is a Codefly 2.x model.
 *
 * @param model The model name to check.
 * @returns True if the model is a Codefly-2.x model.
 */
export function isCodefly2Model(model: string): boolean {
  return /^codefly-2(\.|$)/.test(model);
}

/**
 * Checks if the model is a "custom" model (not Codefly branded).
 *
 * @param model The model name to check.
 * @returns True if the model is not a Codefly branded model.
 */
export function isCustomModel(model: string): boolean {
  const resolved = resolveModel(model);
  return !resolved.startsWith('codefly-');
}

/**
 * Checks if the model should be treated as a modern model.
 * This includes Codefly 3 models and any custom models.
 *
 * @param model The model name to check.
 * @returns True if the model supports modern features like thoughts.
 */
export function supportsModernFeatures(model: string): boolean {
  if (isCodefly3Model(model)) return true;
  return isCustomModel(model);
}

/**
 * Checks if the model is an auto model.
 *
 * @param model The model name to check.
 * @returns True if the model is an auto model.
 */
export function isAutoModel(model: string): boolean {
  return (
    model === CODEFLY_MODEL_ALIAS_AUTO ||
    model === PREVIEW_CODEFLY_MODEL_AUTO ||
    model === DEFAULT_CODEFLY_MODEL_AUTO
  );
}

/**
 * Checks if the model supports multimodal function responses (multimodal data nested within function response).
 * This is supported in Codefly 3.
 *
 * @param model The model name to check.
 * @returns True if the model supports multimodal function responses.
 */
export function supportsMultimodalFunctionResponse(model: string): boolean {
  return model.startsWith('codefly-3-');
}
/**
 * Checks if the model is a Codefly model (including Vertex AI variants).
 *
 * @param model The model name to check.
 * @returns True if the model is a Codefly model.
 */
export function isCodeflyModel(model: string): boolean {
  return (
    model.startsWith('codefly-') ||
    model.startsWith('google/') ||
    /^codefly-\d/.test(model)
  );
}
