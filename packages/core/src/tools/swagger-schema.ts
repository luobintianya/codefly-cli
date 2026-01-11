/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import { SWAGGER_SCHEMA_TOOL_NAME } from './tool-names.js';

export interface SwaggerSchemaToolParams {
  url: string;
  format?: 'json' | 'yaml' | 'summary';
}

interface SwaggerPathMethod {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: Record<string, unknown>;
    type?: string;
  }>;
  requestBody?: {
    content?: Record<string, unknown>;
    required?: boolean;
  };
  responses?: Record<string, unknown>;
  tags?: string[];
}

interface SwaggerSchema {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Array<{ url: string }>;
  basePath?: string;
  host?: string;
  paths?: Record<string, Record<string, SwaggerPathMethod>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
  definitions?: Record<string, unknown>;
}

class SwaggerSchemaToolInvocation extends BaseToolInvocation<
  SwaggerSchemaToolParams,
  ToolResult
> {
  constructor(
    _config: Config,
    params: SwaggerSchemaToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    return `Fetching Swagger/OpenAPI schema from ${this.params.url}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { url, format = 'summary' } = this.params;

    try {
      const result = await this.fetchSwaggerSchema(url, format);

      return {
        llmContent: result,
        returnDisplay: `Fetched Swagger schema from ${url}`,
      };
    } catch (error) {
      return {
        llmContent: `Error fetching Swagger schema: ${error}`,
        returnDisplay: `Error: ${error}`,
        error: {
          message: String(error),
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private async fetchSwaggerSchema(
    url: string,
    format: string,
  ): Promise<string> {
    // Import node-fetch dynamically
    let fetch;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const nodeFetch = await import('node-fetch');
      fetch = nodeFetch.default;
    } catch (_e) {
      throw new Error(
        'Failed to load fetch module. Please ensure node-fetch is available.',
      );
    }

    // Fetch the Swagger/OpenAPI schema
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Swagger schema: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let schema: SwaggerSchema;

    if (contentType.includes('application/json')) {
      schema = (await response.json()) as SwaggerSchema;
    } else if (
      contentType.includes('application/x-yaml') ||
      contentType.includes('text/yaml') ||
      url.endsWith('.yaml') ||
      url.endsWith('.yml')
    ) {
      // Handle YAML format
      let yaml;
      try {
        yaml = await import('js-yaml');
      } catch (_e) {
        throw new Error(
          'The "js-yaml" package is required to parse YAML Swagger files. Please ask the user to install it.',
        );
      }
      const text = await response.text();
      schema = yaml.load(text) as SwaggerSchema;
    } else {
      // Try to parse as JSON first, then YAML
      const text = await response.text();
      try {
        schema = JSON.parse(text) as SwaggerSchema;
      } catch {
        let yaml;
        try {
          yaml = await import('js-yaml');
          schema = yaml.load(text) as SwaggerSchema;
        } catch (_e) {
          throw new Error(
            'Failed to parse Swagger schema. The content is neither valid JSON nor YAML.',
          );
        }
      }
    }

    // Format the output based on the requested format
    if (format === 'json') {
      return JSON.stringify(schema, null, 2);
    } else if (format === 'yaml') {
      let yaml;
      try {
        yaml = await import('js-yaml');
        return yaml.dump(schema);
      } catch (_e) {
        // Fallback to JSON if YAML is not available
        return JSON.stringify(schema, null, 2);
      }
    } else {
      // Default to summary format
      return this.formatSummary(schema);
    }
  }

  private formatSummary(schema: SwaggerSchema): string {
    let output = '';

    // Basic info
    if (schema.info) {
      output += `API: ${schema.info.title || 'Unknown'}\n`;
      output += `Version: ${schema.info.version || 'Unknown'}\n`;
      if (schema.info.description) {
        output += `Description: ${schema.info.description}\n`;
      }
      output += '\n';
    }

    // Server/Base URL
    const version = schema.openapi || schema.swagger || 'Unknown';
    output += `OpenAPI/Swagger Version: ${version}\n`;

    if (schema.servers && schema.servers.length > 0) {
      output += `Servers:\n`;
      for (const server of schema.servers) {
        output += `  - ${server.url}\n`;
      }
    } else if (schema.host || schema.basePath) {
      const baseUrl = `${schema.host || ''}${schema.basePath || ''}`;
      output += `Base URL: ${baseUrl}\n`;
    }
    output += '\n';

    // Endpoints
    if (schema.paths) {
      output += 'Endpoints:\n\n';
      for (const [path, methods] of Object.entries(schema.paths)) {
        for (const [method, details] of Object.entries(methods)) {
          const methodUpper = method.toUpperCase();
          output += `${methodUpper} ${path}\n`;

          if (details.summary) {
            output += `  Summary: ${details.summary}\n`;
          }

          if (details.description) {
            output += `  Description: ${details.description}\n`;
          }

          if (details.operationId) {
            output += `  Operation ID: ${details.operationId}\n`;
          }

          if (details.tags && details.tags.length > 0) {
            output += `  Tags: ${details.tags.join(', ')}\n`;
          }

          if (details.parameters && details.parameters.length > 0) {
            output += `  Parameters:\n`;
            for (const param of details.parameters) {
              const required = param.required ? ' (required)' : '';
              const type = param.schema?.['type'] || param.type || 'unknown';
              output += `    - ${param.name} (${param.in}, ${type})${required}\n`;
            }
          }

          if (details.requestBody) {
            const required = details.requestBody.required ? ' (required)' : '';
            output += `  Request Body${required}\n`;
          }

          if (details.responses) {
            output += `  Responses: ${Object.keys(details.responses).join(', ')}\n`;
          }

          output += '\n';
        }
      }
    }

    // Schemas/Models
    const schemas = schema.components?.schemas || schema.definitions;
    if (schemas && Object.keys(schemas).length > 0) {
      output += `Models/Schemas:\n`;
      for (const schemaName of Object.keys(schemas)) {
        output += `  - ${schemaName}\n`;
      }
    }

    return output;
  }
}

export class SwaggerSchemaTool extends BaseDeclarativeTool<
  SwaggerSchemaToolParams,
  ToolResult
> {
  static readonly Name = SWAGGER_SCHEMA_TOOL_NAME;

  constructor(
    private config: Config,
    messageBus?: MessageBus,
  ) {
    super(
      SwaggerSchemaTool.Name,
      'GetSwaggerSchema',
      'Retrieves and parses Swagger/OpenAPI schema from a URL. Supports both JSON and YAML formats, and can return full schema or a summarized view of endpoints and models.',
      Kind.Fetch,
      {
        properties: {
          url: {
            type: 'string',
            description:
              'The URL of the Swagger/OpenAPI schema file (e.g., https://api.example.com/swagger.json or https://api.example.com/v2/api-docs)',
          },
          format: {
            type: 'string',
            enum: ['json', 'yaml', 'summary'],
            description:
              'The output format. "summary" provides a human-readable overview of endpoints and models, "json" returns the full schema in JSON, "yaml" returns it in YAML. Defaults to "summary".',
          },
        },
        required: ['url'],
        type: 'object',
      },
      true,
      false,
      messageBus,
    );
  }

  protected createInvocation(
    params: SwaggerSchemaToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<SwaggerSchemaToolParams, ToolResult> {
    return new SwaggerSchemaToolInvocation(
      this.config,
      params,
      messageBus,
      _toolName,
      _toolDisplayName,
    );
  }
}
