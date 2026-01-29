/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
import { OpenAICompatibleContentGenerator } from './openaiCompatibleContentGenerator.js';
import { type Content } from '@google/genai';

describe('OpenAICompatibleContentGenerator Tool Mapping', () => {
  const config = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    model: 'gpt-4o',
  };
  const generator = new OpenAICompatibleContentGenerator(config as any);

  it('should map tools with parametersJsonSchema correctly', () => {
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'test_tool',
            description: 'A test tool',
            parametersJsonSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
            },
          },
        ],
      },
    ];

    const mappedTools = (generator as any).mapToolsToOpenAITools(tools);

    expect(mappedTools).toBeDefined();
    expect(mappedTools[0].function.name).toBe('test_tool');
    expect(mappedTools[0].function.parameters).toEqual({
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
    });
  });

  it('should handle tool call IDs in history correctly', () => {
    const contents: Content[] = [
      {
        role: 'user',
        parts: [{ text: 'call tool' }],
      },
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'test_tool',
              args: { query: 'hello' },
              id: 'call_123',
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'test_tool',
              response: { result: 'ok' },
              id: 'call_123',
            },
          },
        ],
      },
    ];

    const messages = (generator as any).mapContentToOpenAIMessages(contents);

    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].tool_calls?.[0]?.id).toBe('call_123');
    expect(messages[2].role).toBe('tool');
    expect(messages[2].tool_call_id).toBe('call_123');
    expect(messages[2].content).toBe('{"result":"ok"}');
  });

  describe('XML Tool Call Parsing', () => {
    it('should parse XML tool call tags in stream content', async () => {
      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let sent = false;
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                const chunk =
                  'data: {"choices":[{"index":0,"delta":{"content":"<tool_call>ls<arg_key>path</arg_key><arg_value>.</arg_value></tool_call>"},"finish_reason":null}]}\n\n';
                return { done: false, value: new TextEncoder().encode(chunk) };
              },
            };
          },
        },
      });
      global.fetch = mockFetch as any;

      const responses = [];
      const stream = await generator.generateContentStream(
        {
          model: 'gpt-4o',
          contents: [{ role: 'user', parts: [{ text: 'list files' }] }],
        },
        'prompt_id',
      );
      for await (const resp of stream) {
        responses.push(resp);
      }

      const toolCallPart = responses[0].candidates?.[0]?.content?.parts?.find(
        (p) => p.functionCall,
      );
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart?.functionCall?.name).toBe('ls');
      expect(toolCallPart?.functionCall?.args).toEqual({ path: '.' });
      expect(toolCallPart?.functionCall?.id).toMatch(/^xml_/);
    });

    it('should parse mixed text and XML tool call tags', async () => {
      const chunk =
        'data: {"choices":[{"index":0,"delta":{"content":"Searching... <tool_call>grep<arg_key>query</arg_key><arg_value>error</arg_value></tool_call> Done."},"finish_reason":null}]}\n\n';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let sent = false;
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: new TextEncoder().encode(chunk) };
              },
            };
          },
        },
      });
      global.fetch = mockFetch as any;

      const responses = [];
      const stream = await generator.generateContentStream(
        {
          model: 'gpt-4o',
          contents: [{ role: 'user', parts: [{ text: 'search' }] }],
        },
        'prompt_id',
      );
      for await (const resp of stream) {
        responses.push(resp);
      }

      const candidate = responses[0].candidates?.[0];
      expect(candidate?.content?.parts).toHaveLength(3);
      expect(candidate?.content?.parts?.[0]?.text).toBe('Searching... ');
      expect(candidate?.content?.parts?.[1]?.functionCall?.name).toBe('grep');
      expect(candidate?.content?.parts?.[2]?.text).toBe(' Done.');
    });
  });

  describe('Token Usage Tracking', () => {
    it('should yield usageMetadata when present in stream', async () => {
      const chunk =
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let sent = false;
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: new TextEncoder().encode(chunk) };
              },
            };
          },
        },
      });
      global.fetch = mockFetch as any;

      const responses = [];
      const stream = await generator.generateContentStream(
        {
          model: 'gpt-4o',
          contents: [{ role: 'user', parts: [{ text: 'count tokens' }] }],
        },
        'prompt_id',
      );
      for await (const resp of stream) {
        responses.push(resp);
      }

      expect(responses).toHaveLength(1);
      expect(responses[0].usageMetadata).toBeDefined();
      expect(responses[0].usageMetadata?.promptTokenCount).toBe(10);
      expect(responses[0].usageMetadata?.candidatesTokenCount).toBe(20);
      expect(responses[0].usageMetadata?.totalTokenCount).toBe(30);
    });
  });
});
