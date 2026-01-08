/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenerateContentParameters } from '@google/genai';
import { OpenAICompatibleContentGenerator } from './openaiCompatibleContentGenerator.js';

describe('OpenAICompatibleContentGenerator', () => {
  const mockConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-api-key',
    model: 'gpt-4o',
  };

  let generator: OpenAICompatibleContentGenerator;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    generator = new OpenAICompatibleContentGenerator(mockConfig);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const generateContentParams: GenerateContentParameters = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Hello' }],
      },
    ],
    config: {},
    model: 'gpt-4o',
  };

  it('should generate content successfully', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello there!',
          },
          finish_reason: 'stop',
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const response = await generator.generateContent(
      generateContentParams,
      'test-prompt-id',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        },
        body: expect.stringContaining('"model":"gpt-4o"'),
      }),
    );
    // Verify mapped content
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);

    expect(response.candidates?.[0]?.content.parts[0].text).toBe(
      'Hello there!',
    );
    expect(response.usageMetadata?.totalTokenCount).toBe(15);
  });

  it('should handle API errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      generator.generateContent(generateContentParams, 'test-prompt-id'),
    ).rejects.toThrow(
      'OpenAI API request failed with status 401: Unauthorized',
    );
  });

  it('should generate content stream successfully', async () => {
    const streamChunks = [
      'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":" World"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const stream = new ReadableStream({
      start(controller) {
        streamChunks.forEach((chunk) =>
          controller.enqueue(new TextEncoder().encode(chunk)),
        );
        controller.close();
      },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const responseStream = await generator.generateContentStream(
      generateContentParams,
      'test-prompt-id',
    );

    const responses = [];
    for await (const response of responseStream) {
      responses.push(response);
    }

    expect(responses).toHaveLength(2); // The last chunk has no content, just finish_reason, maybe handled differently?
    // My implementation only yields if content is present.
    // Chunk 1: "Hello"
    // Chunk 2: " World"
    // Chunk 3: No content

    expect(responses[0].candidates?.[0]?.content.parts[0].text).toBe('Hello');
    expect(responses[1].candidates?.[0]?.content.parts[0].text).toBe(' World');
  });

  it('should return 0 tokens for countTokens', async () => {
    const response = await generator.countTokens({
      contents: [],
    });
    expect(response.totalTokens).toBe(0);
  });
});
