/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAICompatibleContentGenerator } from './openaiCompatibleContentGenerator.js';
// GenerateContentResponse is imported for types if needed, but here we can just leave it out if unused.
// GenerateContentResponse removed as per lint feedback

describe('OpenAICompatibleContentGenerator', () => {
  const config = {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  };

  let generator: OpenAICompatibleContentGenerator;

  beforeEach(() => {
    generator = new OpenAICompatibleContentGenerator(config);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should map tools and tool_choice correctly', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello!',
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

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const request = {
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      config: {
        tools: [
          {
            functionDeclarations: [
              {
                name: 'get_weather',
                description: 'Get weather',
                parameters: {
                  type: 'object',
                  properties: { location: { type: 'string' } },
                },
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY' as const,
          },
        },
      },
    };

    await generator.generateContent(request as any, 'prompt-id');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"tools":'),
      }),
    );

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function.name).toBe('get_weather');
    expect(body.tool_choice).toBe('required');
  });

  it('should handle tool calls in response', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location":"London"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
          index: 0,
        },
      ],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const request = {
      contents: [{ role: 'user', parts: [{ text: 'Weather in London?' }] }],
    };

    const response = await generator.generateContent(
      request as any,
      'prompt-id',
    );

    expect(response.candidates[0].content.parts).toHaveLength(1);
    expect(response.candidates[0].content.parts[0].functionCall).toEqual({
      name: 'get_weather',
      args: { location: 'London' },
      id: 'call_123',
    });
  });

  it('should map function response with tool_call_id back to OpenAI messages', async () => {
    (fetch as unknown as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: '1',
          choices: [
            {
              message: { role: 'assistant', content: 'It is sunny' },
              finish_reason: 'stop',
              index: 0,
            },
          ],
        }),
    });

    const request = {
      contents: [
        { role: 'user', parts: [{ text: 'Weather?' }] },
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'call_abc',
                name: 'get_weather',
                args: { location: 'London' },
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_abc',
                name: 'get_weather',
                response: { weather: 'sunny' },
              },
            },
          ],
        },
      ],
    };

    await generator.generateContent(request as any, 'prompt-id');

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[1].tool_calls).toBeDefined();
    expect(body.messages[1].tool_calls[0].id).toBe('call_abc');
    expect(body.messages[2].role).toBe('tool');
    expect(body.messages[2].content).toBe('{"weather":"sunny"}');
    expect(body.messages[2].tool_call_id).toBe('call_abc');
  });

  it('should handle reasoning_content in response', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            reasoning_content: 'Thinking...',
            content: 'Hello!',
          },
          finish_reason: 'stop',
          index: 0,
        },
      ],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await generator.generateContent(
      { contents: [] } as unknown as any,
      'id',
    );
    const parts = response.candidates![0].content.parts!;
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ text: 'Thinking...', thought: true });
    expect(parts[1].text).toContain('<think>\nThinking...\n</think>');
    expect(parts[2].text).toBe('Hello!');
  });

  it('should handle reasoning_content deltas in generateContentStream', async () => {
    const mockChunks = [
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"Think"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"ing"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}',
      'data: [DONE]',
    ];

    const mockStream = new ReadableStream({
      start(controller) {
        for (const chunk of mockChunks) {
          controller.enqueue(new TextEncoder().encode(chunk + '\n'));
        }
        controller.close();
      },
    });

    (fetch as any).mockResolvedValue({
      ok: true,
      body: mockStream,
    });

    const stream = await generator.generateContentStream(
      { contents: [] } as any,
      'id',
    );
    const results = [];
    for await (const res of stream) {
      results.push(res);
    }

    // Expected sequence:
    // 1. First reasoning delta: ["<think>\n", "Think", "Think (thought: true)"]
    // 2. Second reasoning delta: ["ing", "ing (thought: true)"]
    // 3. First content delta (closes thinking): ["\n</think>\n\n", "Hi"]

    expect(results).toHaveLength(3);

    const parts0 = results[0].candidates![0].content.parts!;
    expect(parts0).toHaveLength(3);
    expect(parts0[0].text).toBe('<think>\n');
    expect(parts0[1].text).toBe('Think');
    expect((parts0[2] as { thought?: boolean }).thought).toBe(true);

    const parts1 = results[1].candidates![0].content.parts!;
    expect(parts1).toHaveLength(2);
    expect(parts1[0].text).toBe('ing');
    expect((parts1[1] as { thought?: boolean }).thought).toBe(true);

    const parts2 = results[2].candidates![0].content.parts!;
    expect(parts2).toHaveLength(2);
    expect(parts2[0].text).toBe('\n</think>\n\n');
    expect(parts2[1].text).toBe('Hi');
  });

  it('should handle multiple parallel tool responses correctly', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: '1',
          choices: [
            {
              message: { role: 'assistant', content: 'Final answer' },
              finish_reason: 'stop',
              index: 0,
            },
          ],
        }),
    });

    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_1',
                name: 'tool_1',
                response: { res: 'one' },
              },
            },
            {
              functionResponse: {
                id: 'call_2',
                name: 'tool_2',
                response: { res: 'two' },
              },
            },
          ],
        },
      ],
    };

    await generator.generateContent(request as any, 'id');

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_1',
      content: '{"res":"one"}',
    });
    expect(body.messages[1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_2',
      content: '{"res":"two"}',
    });
  });

  it('should generate unique IDs for tool calls without IDs', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: '1',
          choices: [
            {
              message: { role: 'assistant', content: 'OK' },
              finish_reason: 'stop',
              index: 0,
            },
          ],
        }),
    });

    const request = {
      contents: [
        {
          role: 'model',
          parts: [
            { functionCall: { name: 'tool_1', args: {} } },
            { functionCall: { name: 'tool_1', args: {} } },
          ],
        },
      ],
    };

    await generator.generateContent(request as any, 'id');

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    const toolCalls = body.messages[0].tool_calls;
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].id).not.toBe(toolCalls[1].id);
    expect(toolCalls[0].id).toContain('call_');
    expect(toolCalls[1].id).toContain('call_');
  });
});
