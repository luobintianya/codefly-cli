/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SwaggerSchemaToolParams } from './swagger-schema.js';
import { SwaggerSchemaTool } from './swagger-schema.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';

// Mock Config
vi.mock('../config/config.js');

describe('SwaggerSchemaTool', () => {
  const abortSignal = new AbortController().signal;
  let tool: SwaggerSchemaTool;

  const mockFetch = vi.fn();
  const mockYamlLoad = vi.fn();
  const mockYamlDump = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock node-fetch
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('error')) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        };
      }

      const mockSwaggerSchema = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
          description: 'Test API Description',
        },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/users': {
            get: {
              summary: 'Get all users',
              operationId: 'getUsers',
              tags: ['users'],
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer' },
                },
              ],
              responses: {
                '200': { description: 'Success' },
                '400': { description: 'Bad Request' },
              },
            },
            post: {
              summary: 'Create user',
              operationId: 'createUser',
              requestBody: {
                required: true,
                content: {
                  'application/json': {},
                },
              },
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {},
            Error: {},
          },
        },
      };

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name === 'content-type' ? 'application/json' : '',
        },
        json: async () => mockSwaggerSchema,
        text: async () => JSON.stringify(mockSwaggerSchema),
      };
    });

    vi.doMock('node-fetch', () => ({
      default: mockFetch,
    }));

    // Mock js-yaml
    mockYamlLoad.mockImplementation((text: string) => JSON.parse(text));
    mockYamlDump.mockImplementation((obj: unknown) =>
      JSON.stringify(obj, null, 2),
    );
    vi.doMock('js-yaml', () => ({
      load: mockYamlLoad,
      dump: mockYamlDump,
    }));

    const mockConfigInstance = {} as unknown as Config;
    tool = new SwaggerSchemaTool(mockConfigInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: SwaggerSchemaToolParams = {
        url: 'https://api.example.com/swagger.json',
        format: 'summary',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });
  });

  describe('execute', () => {
    it('should fetch Swagger schema with summary format', async () => {
      const params: SwaggerSchemaToolParams = {
        url: 'https://api.example.com/swagger.json',
        format: 'summary',
      };

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/swagger.json',
      );

      // Verify output contains expected information
      expect(result.llmContent).toContain('API: Test API');
      expect(result.llmContent).toContain('Version: 1.0.0');
      expect(result.llmContent).toContain('Description: Test API Description');
      expect(result.llmContent).toContain('OpenAPI/Swagger Version: 3.0.0');
      expect(result.llmContent).toContain('https://api.example.com');
      expect(result.llmContent).toContain('GET /users');
      expect(result.llmContent).toContain('POST /users');
      expect(result.llmContent).toContain('Summary: Get all users');
      expect(result.llmContent).toContain('Operation ID: getUsers');
      expect(result.llmContent).toContain('Tags: users');
      expect(result.llmContent).toContain('Parameters:');
      expect(result.llmContent).toContain('limit');
      expect(result.llmContent).toContain('Request Body (required)');
      expect(result.llmContent).toContain('Responses: 200, 400');
      expect(result.llmContent).toContain('Models/Schemas:');
      expect(result.llmContent).toContain('User');
      expect(result.llmContent).toContain('Error');
      expect(result.returnDisplay).toBe(
        'Fetched Swagger schema from https://api.example.com/swagger.json',
      );
    });

    it('should fetch Swagger schema with json format', async () => {
      const params: SwaggerSchemaToolParams = {
        url: 'https://api.example.com/swagger.json',
        format: 'json',
      };

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      // Verify output is valid JSON
      expect(() => JSON.parse(result.llmContent as string)).not.toThrow();
      const parsed = JSON.parse(result.llmContent as string);
      expect(parsed.openapi).toBe('3.0.0');
      expect(parsed.info.title).toBe('Test API');
    });

    it('should handle fetch errors', async () => {
      const params: SwaggerSchemaToolParams = {
        url: 'https://api.example.com/error.json',
        format: 'summary',
      };

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
      expect(result.llmContent).toContain('Error fetching Swagger schema');
      expect(result.llmContent).toContain('404 Not Found');
    });

    it('should use default format when not specified', async () => {
      const params: SwaggerSchemaToolParams = {
        url: 'https://api.example.com/swagger.json',
      };

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      // Default format is summary
      expect(result.llmContent).toContain('API: Test API');
      expect(result.llmContent).toContain('GET /users');
    });

    it('should throw validation error for invalid format', () => {
      const params = {
        url: 'https://api.example.com/swagger.json',
        format: 'xml', // Invalid format
      } as unknown as SwaggerSchemaToolParams;

      expect(() => tool.build(params)).toThrow(
        /params\/format must be equal to one of the allowed values/,
      );
    });

    it('should throw validation error for missing url', () => {
      const params = {
        format: 'json',
        // Missing url
      } as unknown as SwaggerSchemaToolParams;

      expect(() => tool.build(params)).toThrow(
        /params must have required property 'url'/,
      );
    });
  });

  describe('getDescription', () => {
    it('should return correct description', () => {
      const params: SwaggerSchemaToolParams = {
        url: 'https://api.example.com/swagger.json',
      };

      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe(
        'Fetching Swagger/OpenAPI schema from https://api.example.com/swagger.json',
      );
    });
  });
});
