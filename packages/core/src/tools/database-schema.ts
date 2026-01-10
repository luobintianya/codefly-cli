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
import { DATABASE_SCHEMA_TOOL_NAME } from './tool-names.js';

export interface DatabaseSchemaToolParams {
  type: 'mysql' | 'postgres';
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
}

class DatabaseSchemaToolInvocation extends BaseToolInvocation<
  DatabaseSchemaToolParams,
  ToolResult
> {
  constructor(
    _config: Config,
    params: DatabaseSchemaToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    return `Fetching schema for ${this.params.type} database at ${this.params.host}:${this.params.port || (this.params.type === 'mysql' ? 3306 : 5432)}/${this.params.database}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { type, host, user, password, database, port } = this.params;

    try {
      let result = '';
      if (type === 'mysql') {
        result = await this.fetchMysqlSchema(
          host,
          port || 3306,
          user,
          password,
          database,
        );
      } else if (type === 'postgres') {
        result = await this.fetchPostgresSchema(
          host,
          port || 5432,
          user,
          password,
          database,
        );
      } else {
        throw new Error(`Unsupported database type: ${type}`);
      }

      return {
        llmContent: result,
        returnDisplay: `Fetched schema for ${database}`,
      };
    } catch (error) {
      return {
        llmContent: `Error fetching schema: ${error}`,
        returnDisplay: `Error: ${error}`,
        error: {
          message: String(error),
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private async fetchMysqlSchema(
    host: string,
    port: number,
    user: string,
    password: string | undefined,
    database: string,
  ): Promise<string> {
    let mysql;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      mysql = await import('mysql2/promise');
    } catch (_e) {
      throw new Error(
        'The "mysql2" package is required to use this tool for MySQL. Please ask the user to install it.',
      );
    }

    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    try {
      const [rows] = await connection.execute(
        `SELECT table_name, column_name, data_type, is_nullable, column_key 
         FROM information_schema.columns 
         WHERE table_schema = ? 
         ORDER BY table_name, ordinal_position`,
        [database],
      );

      return this.formatSchema(rows as Array<Record<string, string>>);
    } finally {
      await connection.end();
    }
  }

  private async fetchPostgresSchema(
    host: string,
    port: number,
    user: string,
    password: string | undefined,
    database: string,
  ): Promise<string> {
    let pg;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      pg = await import('pg');
    } catch (_e) {
      throw new Error(
        'The "pg" package is required to use this tool for PostgreSQL. Please ask the user to install it.',
      );
    }

    const { Client } = pg.default || pg;
    const client = new Client({
      host,
      port,
      user,
      password,
      database,
    });

    await client.connect();

    try {
      const res = await client.query(
        `SELECT table_name, column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_catalog = $1 AND table_schema = 'public' 
         ORDER BY table_name, ordinal_position`,
        [database],
      );

      return this.formatSchema(res.rows as Array<Record<string, string>>);
    } finally {
      await client.end();
    }
  }

  private formatSchema(rows: Array<Record<string, string>>): string {
    const tables: Record<string, string[]> = {};
    for (const row of rows) {
      const tableName = row['table_name'] || row['TABLE_NAME'];
      const columnName = row['column_name'] || row['COLUMN_NAME'];
      const dataType = row['data_type'] || row['DATA_TYPE'];
      const isNullable = row['is_nullable'] || row['IS_NULLABLE'];
      const key = row['column_key'] || row['COLUMN_KEY']; // MySQL specific

      if (!tables[tableName]) {
        tables[tableName] = [];
      }

      let line = `- ${columnName} (${dataType})`;
      if (isNullable === 'YES') line += ' NULL';
      if (key) line += ` [${key}]`;

      tables[tableName].push(line);
    }

    let output = '';
    for (const [table, columns] of Object.entries(tables)) {
      output += `Table: ${table}\n`;
      output += columns.join('\n') + '\n\n';
    }
    return output;
  }
}

export class DatabaseSchemaTool extends BaseDeclarativeTool<
  DatabaseSchemaToolParams,
  ToolResult
> {
  static readonly Name = DATABASE_SCHEMA_TOOL_NAME;

  constructor(
    private config: Config,
    messageBus?: MessageBus,
  ) {
    super(
      DatabaseSchemaTool.Name,
      'GetDatabaseSchema',
      'Retrieves the database schema (tables and columns) from a MySQL or PostgreSQL database.',
      Kind.Fetch,
      {
        properties: {
          type: {
            type: 'string',
            enum: ['mysql', 'postgres'],
            description: 'The type of the database.',
          },
          host: {
            type: 'string',
            description: 'The database host address.',
          },
          port: {
            type: 'number',
            description:
              'The port number of the database. Defaults to 3306 for MySQL and 5432 for PostgreSQL.',
          },
          user: {
            type: 'string',
            description: 'The username to connect to the database.',
          },
          password: {
            type: 'string',
            description: 'The password to connect to the database.',
          },
          database: {
            type: 'string',
            description: 'The name of the database to query.',
          },
        },
        required: ['type', 'host', 'user', 'database'],
        type: 'object',
      },
      true,
      false,
      messageBus,
    );
  }

  protected createInvocation(
    params: DatabaseSchemaToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<DatabaseSchemaToolParams, ToolResult> {
    return new DatabaseSchemaToolInvocation(
      this.config,
      params,
      messageBus,
      _toolName,
      _toolDisplayName,
    );
  }
}
