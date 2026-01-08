/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  Content,
  FinishReason,
} from '@google/genai';
import { GenerateContentResponse } from '@google/genai';
import { toContents } from '../code_assist/converter.js';
import type { ContentGenerator } from './contentGenerator.js';
import type { UserTierId } from '../code_assist/types.js';

interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: OpenAIMessage;
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamResponse {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason: string | null;
    index: number;
  }>;
}

export class OpenAICompatibleContentGenerator implements ContentGenerator {
  userTier?: UserTierId;

  constructor(private readonly config: OpenAIConfig) {}

  private mapContentToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
    return contents.map((content) => {
      let role = content.role === 'model' ? 'assistant' : 'user';
      if (role === 'user' && !content.role) {
        // Default to user if no role specified, assuming it's prompt
        role = 'user';
      }

      const textParts = (content.parts || [])
        .filter((part) => part.text)
        .map((part) => part.text)
        .join('');

      return {
        role,
        content: textParts,
      };
    });
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const contents = toContents(request.contents);
    const messages = this.mapContentToOpenAIMessages(contents);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.config.model,
        messages,
        // TODO: Map other parameters like temperature, topP, etc.
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API request failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices[0];

    const genResponse = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: choice.message.content }],
          },
          finishReason: choice.finish_reason as FinishReason,
          index: choice.index,
        },
      ],
      usageMetadata: data.usage
        ? {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens,
          }
        : undefined,
    };
    return Object.setPrototypeOf(
      genResponse,
      GenerateContentResponse.prototype,
    );
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const contents = toContents(request.contents);
    const messages = this.mapContentToOpenAIMessages(contents);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || this.config.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API request failed with status ${response.status}: ${await response.text()}`,
      );
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return (async function* () {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as OpenAIStreamResponse;
              const choice = data.choices[0];
              const content = choice.delta.content;

              if (content) {
                const genResponse = {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts: [{ text: content }],
                      },
                      finishReason: choice.finish_reason
                        ? (choice.finish_reason as FinishReason)
                        : undefined,
                      index: choice.index,
                    },
                  ],
                };
                yield Object.setPrototypeOf(
                  genResponse,
                  GenerateContentResponse.prototype,
                );
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    })();
  }

  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Placeholder: Simple estimation or stub
    // OpenAI doesn't have a direct equivalent API in the same way,
    // often handled by tiktoken locally or just ignored.
    // For now, return 0 or estimated.
    return {
      totalTokens: 0,
    };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error(
      'embedContent not implemented for OpenAI compatible provider yet.',
    );
  }
}
