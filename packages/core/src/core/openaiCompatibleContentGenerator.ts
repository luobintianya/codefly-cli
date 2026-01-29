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
  Part,
  FinishReason,
  ToolListUnion,
  ToolConfig,
} from '@google/genai';
import { toContents } from './converter.js';
import type { ContentGenerator } from './contentGenerator.js';
import { coreEvents } from '../utils/events.js';
import { GenerateContentResponse } from '@google/genai';

interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface OpenAIToolCall {
  id?: string;
  index?: number;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  reasoning_content?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
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
      reasoning_content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string | null;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ... (existing imports)

export class OpenAICompatibleContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;

  constructor(private readonly config: OpenAIConfig) {
    let normalizedBaseUrl = this.config.baseUrl.replace(/\/+$/, '');
    if (normalizedBaseUrl.endsWith('/chat/completions')) {
      normalizedBaseUrl = normalizedBaseUrl.slice(
        0,
        -'/chat/completions'.length,
      );
    }
    this.baseUrl = normalizedBaseUrl;
  }

  private getAuthToken(): string {
    const apiKey = this.config.apiKey.trim();
    return apiKey;
  }

  private mapContentToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    for (const content of contents) {
      let role = content.role === 'model' ? 'assistant' : 'user';
      if (role === 'user' && !content.role) {
        role = 'user';
      }

      const parts = content.parts || [];
      const textParts = parts
        .filter((part) => part.text)
        .map((part) => part.text)
        .join('');

      const toolCalls = parts
        .filter((part) => part.functionCall)
        .map((part) => ({
          id:
            part.functionCall!.id ||
            `call_${Math.random().toString(36).slice(2, 11)}`,
          type: 'function' as const,
          function: {
            name: part.functionCall!.name || 'unknown',
            arguments: JSON.stringify(part.functionCall!.args),
          },
        }));

      const functionResponseParts = parts.filter(
        (part) => part.functionResponse,
      );

      if (functionResponseParts.length > 0) {
        for (const part of functionResponseParts) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(part.functionResponse!.response),
            tool_call_id:
              part.functionResponse!.id || part.functionResponse!.name,
          });
        }
      } else {
        messages.push({
          role,
          content: textParts || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });
      }
    }

    return messages;
  }

  private mapToolsToOpenAITools(
    tools: ToolListUnion | undefined,
  ): Array<Record<string, unknown>> | undefined {
    if (!tools || !Array.isArray(tools)) return undefined;

    const openAITools: Array<Record<string, unknown>> = [];
    for (const tool of tools) {
      const toolObj = tool as {
        functionDeclarations?: Array<{
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
          parametersJsonSchema?: Record<string, unknown>;
        }>;
      };
      if (toolObj.functionDeclarations) {
        for (const fd of toolObj.functionDeclarations) {
          openAITools.push({
            type: 'function',
            function: {
              name: fd.name,
              description: fd.description,
              parameters: fd.parameters || fd.parametersJsonSchema || {},
            },
          });
        }
      }
    }
    return openAITools.length > 0 ? openAITools : undefined;
  }

  private mapToolConfigToOpenAIToolChoice(
    toolConfig: ToolConfig | undefined,
  ): Record<string, unknown> | string | undefined {
    if (!toolConfig || !toolConfig.functionCallingConfig) return undefined;

    const mode = toolConfig.functionCallingConfig.mode;
    if (mode === 'ANY') return 'required';
    if (mode === 'NONE') return 'none';
    if (mode === 'AUTO') return 'auto';

    if (
      toolConfig.functionCallingConfig.allowedFunctionNames &&
      toolConfig.functionCallingConfig.allowedFunctionNames.length > 0
    ) {
      return {
        type: 'function',
        function: {
          name: toolConfig.functionCallingConfig.allowedFunctionNames[0],
        },
      };
    }

    return undefined;
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const contents = toContents(request.contents);
    const messages = this.mapContentToOpenAIMessages(contents);

    if (request.config?.systemInstruction) {
      const systemContent = toContents(request.config.systemInstruction)[0];
      const systemText = (systemContent.parts || [])
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('');
      if (systemText) {
        messages.unshift({
          role: 'system',
          content: systemText,
        });
      }
    }

    const token = this.getAuthToken();

    const requestBody = {
      model: this.resolveModelName(request.model),
      messages,
      tools: this.mapToolsToOpenAITools(request.config?.tools),
      tool_choice: this.mapToolConfigToOpenAIToolChoice(
        request.config?.toolConfig,
      ),
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      max_tokens: request.config?.maxOutputTokens,
      stop: request.config?.stopSequences,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API request failed with status ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices[0];

    const parts: Content['parts'] = [];
    if (choice.message.reasoning_content) {
      parts.push({
        text: choice.message.reasoning_content,
        thought: true,
      } as unknown as Part);
      parts.push({
        text: `<think>\n${choice.message.reasoning_content}\n</think>\n\n`,
      });
    }
    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.function?.name && tc.function?.arguments) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments) as Record<
                string,
                unknown
              >,
              id: tc.id,
            },
          });
        }
      }
    }

    const genResponse = {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
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

    if (request.config?.systemInstruction) {
      const systemContent = toContents(request.config.systemInstruction)[0];
      const systemText = (systemContent.parts || [])
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('');
      if (systemText) {
        messages.unshift({
          role: 'system',
          content: systemText,
        });
      }
    }

    const token = this.getAuthToken();

    const requestBody = {
      model: this.resolveModelName(request.model),
      messages,
      stream: true,
      tools: this.mapToolsToOpenAITools(request.config?.tools),
      tool_choice: this.mapToolConfigToOpenAIToolChoice(
        request.config?.toolConfig,
      ),
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      max_tokens: request.config?.maxOutputTokens,
      stop: request.config?.stopSequences,
      stream_options: {
        include_usage: true,
      },
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API request failed with ${token} status ${response.status}: ${errorText}`,
      );
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return (async function* () {
      let buffer = '';
      let isThinking = false;
      const toolCallsAccumulator: Map<
        number,
        { id?: string; name?: string; arguments: string }
      > = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            const jsonStr = trimmedLine.slice(6);
            coreEvents.emitConsoleLog('debug', `[OpenAI Stream] ${jsonStr}`);

            try {
              const data = JSON.parse(jsonStr) as OpenAIStreamResponse;

              // Handle usage metadata in stream
              if (data.usage) {
                const genResponse = {
                  candidates: [],
                  usageMetadata: {
                    promptTokenCount: data.usage.prompt_tokens,
                    candidatesTokenCount: data.usage.completion_tokens,
                    totalTokenCount: data.usage.total_tokens,
                  },
                };
                yield Object.setPrototypeOf(
                  genResponse,
                  GenerateContentResponse.prototype,
                );
              }

              const choice = data.choices[0];
              if (!choice) continue;

              const delta = choice.delta;
              const finishReason = choice.finish_reason;

              // Handle reasoning_content deltas
              if (delta.reasoning_content) {
                const parts: Content['parts'] = [];
                if (!isThinking) {
                  isThinking = true;
                  parts.push({ text: '<think>\n' });
                }
                parts.push({ text: delta.reasoning_content });
                parts.push({
                  text: delta.reasoning_content,
                  thought: true,
                } as unknown as Part);

                const genResponse = {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts,
                      },
                      finish_reason: finishReason
                        ? (finishReason as FinishReason)
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

              // Handle content deltas
              if (delta.content) {
                const parts: Content['parts'] = [];
                if (isThinking) {
                  isThinking = false;
                  parts.push({ text: '\n</think>\n\n' });
                }

                // --- XML Tool Call Interception ---
                // We buffer content text to find complete <tool_call> blocks.
                // This is a simplified interception: if we see <tool_call>, we might delay yielding
                // until we see </tool_call> or the stream ends.
                // But delta-by-delta parsing is safer for UI responsiveness.

                // For now, let's check if the content contains <tool_call> tags.
                // If it does, we try to parse it. This works best if the model outputs
                // the whole tag in one or two chunks.
                const content = delta.content;
                const toolCallRegex =
                  /<tool_call>(.*?)<arg_key>(.*?)<\/arg_key><arg_value>(.*?)<\/arg_value><\/tool_call>/gs;
                let match;
                let lastIndex = 0;
                let foundToolCall = false;

                while ((match = toolCallRegex.exec(content)) !== null) {
                  foundToolCall = true;
                  // Yield text before the tool call
                  if (match.index > lastIndex) {
                    parts.push({ text: content.slice(lastIndex, match.index) });
                  }

                  const toolName = match[1].trim();
                  const key = match[2].trim();
                  const value = match[3].trim();

                  // Construct a function call part
                  parts.push({
                    functionCall: {
                      name: toolName,
                      args: { [key]: value },
                      id: `xml_${Math.random().toString(36).slice(2, 11)}`,
                    },
                  });

                  lastIndex = toolCallRegex.lastIndex;
                }

                if (foundToolCall) {
                  // Yield remaining text
                  if (lastIndex < content.length) {
                    parts.push({ text: content.slice(lastIndex) });
                  }
                } else {
                  // Standard content flow
                  parts.push({ text: content });
                }

                const genResponse = {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts,
                      },
                      finishReason: finishReason
                        ? (finishReason as FinishReason)
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

              // Handle tool call deltas (Standard OpenAI tool_calls)
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const index = tc.index ?? 0;
                  if (!toolCallsAccumulator.has(index)) {
                    toolCallsAccumulator.set(index, { arguments: '' });
                  }
                  const acc = toolCallsAccumulator.get(index)!;
                  if (tc.id) acc.id = tc.id;
                  if (tc.function?.name) acc.name = tc.function.name;
                  if (tc.function?.arguments) {
                    acc.arguments += tc.function.arguments;
                  }
                }
              }

              // If stream finished and we have standard tool calls, yield them
              if (finishReason === 'tool_calls' || finishReason === 'stop') {
                if (toolCallsAccumulator.size > 0) {
                  const parts: Content['parts'] = [];
                  for (const acc of toolCallsAccumulator.values()) {
                    if (acc.name && acc.arguments) {
                      try {
                        const args = JSON.parse(acc.arguments);
                        parts.push({
                          functionCall: {
                            name: acc.name,
                            args: args as Record<string, unknown>,
                            id: acc.id,
                          },
                        });
                        coreEvents.emitConsoleLog(
                          'debug',
                          `[OpenAI Tool Call] Yielding: ${acc.name}(${acc.arguments})`,
                        );
                      } catch (_e) {
                        coreEvents.emitConsoleLog(
                          'error',
                          `[OpenAI Tool Call] Failed to parse arguments for ${acc.name}: ${acc.arguments}`,
                        );
                      }
                    }
                  }

                  if (parts.length > 0) {
                    const genResponse = {
                      candidates: [
                        {
                          content: {
                            role: 'model',
                            parts,
                          },
                          finishReason: finishReason as FinishReason,
                          index: choice.index,
                        },
                      ],
                    };
                    yield Object.setPrototypeOf(
                      genResponse,
                      GenerateContentResponse.prototype,
                    );
                  }
                  toolCallsAccumulator.clear();
                }
              }
            } catch (_e) {
              coreEvents.emitConsoleLog(
                'error',
                `[OpenAI Stream] Failed to parse JSON: ${line}`,
              );
            }
          }
        }
      }
    })();
  }
  // ... (rest of the file)

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

  /**
   * Resolves the model name to use for the request.
   * If a Gemini model name is requested (usually from an internal alias like 'classifier'),
   * but the provider is OpenAI-compatible, we redirect it to the configured OpenAI model
   * unless the configured OpenAI model itself looks like a Gemini model (which might happen
   * if the user is using a proxy specifically for Gemini).
   */
  private resolveModelName(requestedModel: string | undefined): string {
    const model = requestedModel || this.config.model;
    if (
      model.startsWith('gemini-') &&
      !this.config.model.startsWith('gemini-')
    ) {
      return this.config.model;
    }
    return model;
  }
}
