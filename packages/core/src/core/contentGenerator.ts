/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import type { Config } from '../config/config.js';
import { loadApiKey } from './apiKeyCredentialStorage.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { FakeContentGenerator } from './fakeContentGenerator.js';
import { parseCustomHeaders } from '../utils/customHeaderUtils.js';
import { RecordingContentGenerator } from './recordingContentGenerator.js';
import { getVersion, resolveModel } from '../../index.js';
import { OpenAICompatibleContentGenerator } from './openaiCompatibleContentGenerator.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  LEGACY_CLOUD_SHELL = 'cloud-shell',
  COMPUTE_ADC = 'compute-default-credentials',
  OPENAI = 'openai',
  ZHIPU = 'zhipu',
}

export type ContentGeneratorConfig = {
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
  baseUrl?: string;
  model?: string;
};

export async function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): Promise<ContentGeneratorConfig> {
  const geminiApiKey =
    process.env['GEMINI_API_KEY'] || (await loadApiKey()) || undefined;
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject =
    process.env['GOOGLE_CLOUD_PROJECT'] ||
    process.env['GOOGLE_CLOUD_PROJECT_ID'] ||
    undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;

  const openaiApiKey =
    process.env['OPENAI_API_KEY'] || config.openaiConfig?.apiKey || undefined;
  const openaiBaseUrl =
    process.env['OPENAI_BASE_URL'] ||
    config.openaiConfig?.baseUrl ||
    'https://api.openai.com/v1';
  const openaiModel =
    process.env['OPENAI_MODEL'] || config.openaiConfig?.model || 'gpt-4o';

  const zhipuApiKey = process.env['ZHIPU_API_KEY'] || undefined;
  const zhipuBaseUrl =
    process.env['ZHIPU_BASE_URL'] || 'https://open.bigmodel.cn/api/paas/v4';
  const zhipuModel = process.env['ZHIPU_MODEL'] || 'glm-4';

  const contentGeneratorConfig: ContentGeneratorConfig = {
    authType,
    proxy: config?.getProxy(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.COMPUTE_ADC
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.OPENAI && openaiApiKey) {
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.baseUrl = openaiBaseUrl;
    contentGeneratorConfig.model = openaiModel;
    return contentGeneratorConfig;
  }

  if (authType === AuthType.ZHIPU && zhipuApiKey) {
    contentGeneratorConfig.apiKey = zhipuApiKey;
    contentGeneratorConfig.baseUrl = zhipuBaseUrl;
    contentGeneratorConfig.model = zhipuModel;
    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  _sessionId?: string,
): Promise<ContentGenerator> {
  const generator = await (async () => {
    if (gcConfig.fakeResponses) {
      return FakeContentGenerator.fromFile(gcConfig.fakeResponses);
    }
    const version = await getVersion();
    const model = resolveModel(
      gcConfig.getModel(),
      gcConfig.getPreviewFeatures(),
    );
    const customHeadersEnv =
      process.env['GEMINI_CLI_CUSTOM_HEADERS'] || undefined;
    const userAgent = `GeminiCLI/${version}/${model} (${process.platform}; ${process.arch})`;
    const customHeadersMap = parseCustomHeaders(customHeadersEnv);
    const apiKeyAuthMechanism =
      process.env['GEMINI_API_KEY_AUTH_MECHANISM'] || 'x-goog-api-key';

    const baseHeaders: Record<string, string> = {
      ...customHeadersMap,
      'User-Agent': userAgent,
    };

    if (
      apiKeyAuthMechanism === 'bearer' &&
      (config.authType === AuthType.USE_GEMINI ||
        config.authType === AuthType.USE_VERTEX_AI) &&
      config.apiKey
    ) {
      baseHeaders['Authorization'] = `Bearer ${config.apiKey}`;
    }

    if (
      config.authType === AuthType.LOGIN_WITH_GOOGLE ||
      config.authType === AuthType.COMPUTE_ADC
    ) {
      const httpOptions = { headers: baseHeaders };
      return new LoggingContentGenerator(
        await createCodeAssistContentGenerator(
          httpOptions,
          config.authType,
          gcConfig,
          _sessionId,
        ),
        gcConfig,
      );
    }

    if (
      config.authType === AuthType.USE_GEMINI ||
      config.authType === AuthType.USE_VERTEX_AI
    ) {
      const headers: Record<string, string> = { ...baseHeaders };
      const httpOptions = { headers };

      const googleGenAI = new GoogleGenAI({
        apiKey: config.apiKey === '' ? undefined : config.apiKey,
        vertexai: config.vertexai,
        httpOptions,
      });
      return new LoggingContentGenerator(googleGenAI.models, gcConfig);
    }

    if (
      (config.authType === AuthType.OPENAI ||
        config.authType === AuthType.ZHIPU) &&
      config.apiKey &&
      config.baseUrl &&
      config.model
    ) {
      return new LoggingContentGenerator(
        new OpenAICompatibleContentGenerator({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        }),
        gcConfig,
      );
    }

    throw new Error(
      `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
    );
  })();

  if (gcConfig.recordResponses) {
    return new RecordingContentGenerator(generator, gcConfig.recordResponses);
  }

  return generator;
}
