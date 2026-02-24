/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const PREVIEW_CODEFLY_MODEL = 'gemini-3-pro-preview';
export const PREVIEW_CODEFLY_FLASH_MODEL = 'gemini-3-flash-preview';
// Keep Gemini 2.x constants for backwards compatibility but use Gemini 3 Pro as default
export const DEFAULT_CODEFLY_MODEL = PREVIEW_CODEFLY_MODEL; // Default to Pro
export const DEFAULT_CODEFLY_FLASH_MODEL = PREVIEW_CODEFLY_FLASH_MODEL;
// Gemini 2.x legacy constants (deprecated)
export const LEGACY_GEMINI_2_5_PRO = 'gemini-2.5-pro';
export const LEGACY_GEMINI_2_5_FLASH = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite';

export const VALID_CODEFLY_MODELS = new Set([
  PREVIEW_CODEFLY_MODEL,
  PREVIEW_CODEFLY_FLASH_MODEL,
  LEGACY_GEMINI_2_5_PRO,
  LEGACY_GEMINI_2_5_FLASH,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
]);

export const PREVIEW_CODEFLY_MODEL_AUTO = 'auto-gemini-3';
export const DEFAULT_CODEFLY_MODEL_AUTO = 'auto-gemini-3';

// Model aliases for user convenience.
export const CODEFLY_MODEL_ALIAS_AUTO = 'auto';
export const CODEFLY_MODEL_ALIAS_PRO = 'pro';
export const CODEFLY_MODEL_ALIAS_FLASH = 'flash';
export const CODEFLY_MODEL_ALIAS_FLASH_LITE = 'flash-lite';

export const DEFAULT_CODEFLY_EMBEDDING_MODEL = 'gemini-embedding-001';

// Cap the thinking at 8192 to prevent run-away thinking loops.
export const DEFAULT_THINKING_MODE = 8192;

/**
 * Resolves the requested model alias (e.g., 'auto-gemini-3', 'pro', 'flash', 'flash-lite')
 * to a concrete model name.
 *
 * @param requestedModel The model alias or concrete model name requested by the user.
 * @param useGemini3_1 Whether to use Gemini 3.1 Pro Preview for auto/pro aliases.
 * @returns The resolved concrete model name.
 */
export function resolveModel(
  requestedModel: string,
  useGemini3_1: boolean = false,
  useCustomToolModel: boolean = false,
): string {
  switch (requestedModel) {
    case PREVIEW_CODEFLY_MODEL_AUTO: {
      return PREVIEW_CODEFLY_MODEL; // Auto uses Pro by default for Gemini 3
    }
    case DEFAULT_CODEFLY_MODEL_AUTO: {
      return PREVIEW_CODEFLY_MODEL; // Auto uses Pro by default for Gemini 3
    }
    case CODEFLY_MODEL_ALIAS_AUTO:
    case CODEFLY_MODEL_ALIAS_PRO: {
      return previewFeaturesEnabled
        ? PREVIEW_CODEFLY_MODEL
        : DEFAULT_CODEFLY_MODEL;
    }
    case CODEFLY_MODEL_ALIAS_FLASH: {
      return previewFeaturesEnabled
        ? PREVIEW_CODEFLY_FLASH_MODEL
        : DEFAULT_CODEFLY_FLASH_MODEL;
    }
    case CODEFLY_MODEL_ALIAS_FLASH_LITE: {
      return DEFAULT_GEMINI_FLASH_LITE_MODEL;
    }
    default: {
      return requestedModel;
    }
  }
}

/**
 * Resolves the appropriate model based on the classifier's decision.
 *
 * @param requestedModel The current requested model (e.g. auto-gemini-2.5).
 * @param modelAlias The alias selected by the classifier ('flash' or 'pro').
 * @returns The resolved concrete model name.
 */
export function resolveClassifierModel(
  requestedModel: string,
  modelAlias: string,
  useGemini3_1: boolean = false,
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
    return resolveModel(CODEFLY_MODEL_ALIAS_FLASH, previewFeaturesEnabled);
  }
  return resolveModel(requestedModel, useGemini3_1, useCustomToolModel);
}
export function getDisplayString(model: string) {
  switch (model) {
    case PREVIEW_CODEFLY_MODEL_AUTO:
      return 'Auto (Gemini 3)';
    case DEFAULT_CODEFLY_MODEL_AUTO:
      return 'Auto (Gemini 2.5)';
    case CODEFLY_MODEL_ALIAS_PRO:
      return previewFeaturesEnabled
        ? PREVIEW_CODEFLY_MODEL
        : DEFAULT_CODEFLY_MODEL;
    case CODEFLY_MODEL_ALIAS_FLASH:
      return previewFeaturesEnabled
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
 * Checks if the model is a Gemini 3 model.
 *
 * @param model The model name to check.
 * @returns True if the model is a Gemini 3 model.
 */
export function isGemini3Model(model: string): boolean {
  const resolved = resolveModel(model);
  return /^gemini-3(\.|-|$)/.test(resolved);
}

/**
 * Checks if the model is a Gemini 2.x model.
 *
 * @param model The model name to check.
 * @returns True if the model is a Gemini-2.x model.
 */
export function isCodefly2Model(model: string): boolean {
  return /^gemini-2(\.|$)/.test(model);
}

/**
 * Checks if the model is a "custom" model (not Gemini branded).
 *
 * @param model The model name to check.
 * @returns True if the model is not a Gemini branded model.
 */
export function isCustomModel(model: string): boolean {
  const resolved = resolveModel(model);
  return !resolved.startsWith('gemini-');
}

/**
 * Checks if the model should be treated as a modern model.
 * This includes Gemini 3 models and any custom models.
 *
 * @param model The model name to check.
 * @returns True if the model supports modern features like thoughts.
 */
export function supportsModernFeatures(model: string): boolean {
  if (isGemini3Model(model)) return true;
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
 * This is supported in Gemini 3.
 *
 * @param model The model name to check.
 * @returns True if the model supports multimodal function responses.
 */
export function supportsMultimodalFunctionResponse(model: string): boolean {
  return model.startsWith('gemini-3-');
}
/**
 * Checks if the model is a Gemini model (including Vertex AI variants).
 *
 * @param model The model name to check.
 * @returns True if the model is a Gemini model.
 */
export function isGeminiModel(model: string): boolean {
  return (
    model.startsWith('gemini-') ||
    model.startsWith('google/') ||
    /^gemini-\d/.test(model)
  );
}
