/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import { DRAWIO_TO_SQL_TOOL_NAME } from './tool-names.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';

const inflateRawAsync = promisify(inflateRaw);

export interface DrawioToSqlToolParams {
  filePath: string;
  dbConfig?: {
    type: 'mysql' | 'postgres';
    host: string;
    port?: number;
    user: string;
    password?: string;
    database: string;
  };
  execute?: boolean;
}

class DrawioToSqlToolInvocation extends BaseToolInvocation<
  DrawioToSqlToolParams,
  ToolResult
> {
  constructor(
    params: DrawioToSqlToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    return `Extracting SQL from ${this.params.filePath}${this.params.dbConfig && this.params.execute ? ' and executing it' : ''}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const rawContent = await fs.readFile(this.params.filePath, 'utf-8');
      const xmlContent = await this.decodeDrawio(rawContent);
      const sql = this.parseDrawioToSql(xmlContent);

      let executionResult = '';
      if (this.params.dbConfig && this.params.execute) {
        executionResult = await this.executeSql(sql, this.params.dbConfig);
      }

      return {
        llmContent:
          sql +
          (executionResult ? `\n\nExecution Result:\n${executionResult}` : ''),
        returnDisplay: `Generated SQL from ${this.params.filePath}${executionResult ? ' and executed it' : ''}`,
      };
    } catch (error) {
      return {
        llmContent: `Error: ${error}`,
        returnDisplay: `Error: ${error}`,
        error: {
          message: String(error),
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private async decodeDrawio(content: string): Promise<string> {
    if (content.trim().startsWith('<mxfile')) {
      const diagramMatch = content.match(/<diagram[^>]*>(.*?)<\/diagram>/s);
      if (diagramMatch) {
        const raw = diagramMatch[1].trim();
        // If it seems base64 encoded (no obvious XML tags inside)
        if (raw && !raw.startsWith('<') && !raw.includes(' ')) {
          try {
            const buffer = Buffer.from(raw, 'base64');
            const decompressed = await inflateRawAsync(buffer);
            return decodeURIComponent(decompressed.toString());
          } catch (_e) {
            // Fallback: maybe it wasn't compressed matching that logic
            return content;
          }
        }
      }
    }
    return content;
  }

  private parseDrawioToSql(xml: string): string {
    // Simple Regex Parser for mxCell
    // Finds all mxCell tags
    const cellRegex = /<mxCell([^>]*)>/g;
    const attrRegex = /([a-z0-9]+)="([^"]*)"/gi;

    const cells: Record<
      string,
      { id: string; parent?: string; value?: string; style?: string }
    > = {};

    let match;
    while ((match = cellRegex.exec(xml)) !== null) {
      const attrsStr = match[1];
      const attrs: Record<string, string> = {};
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }
      if (attrs['id']) {
        // Decode HTML entities in value
        if (attrs['value']) {
          attrs['value'] = attrs['value']
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/<[^>]+>/g, '') // Remove HTML tags if any
            .replace(/&nbsp;/g, ' ')
            .trim();
        }
        cells[attrs['id']] = {
          id: attrs['id'],
          parent: attrs['parent'],
          value: attrs['value'],
          style: attrs['style'],
        };
      }
    }

    // Build Hierarchy
    const tables: Record<string, string[]> = {};

    // Find Tables (Items directly on the default layer "1")
    // Or items that look like tables (swimlanes or rectangles with names)
    for (const id in cells) {
      const cell = cells[id];
      // Heuristic: A table is usually a vertex, has a name, and is on the root layer (parent="1")
      // Or it's a "swimlane" from style.

      // We assume simple structure:
      // - Table represented by a Node with parent="1" (or whatever the main layer is)
      // - Columns represented by Nodes with parent="<tableId>"
      if (cell.parent === '1' && cell.value) {
        tables[cell.id] = [];
      }
    }

    // Find Columns
    for (const id in cells) {
      const cell = cells[id];
      if (cell.parent && tables[cell.parent] && cell.value) {
        tables[cell.parent].push(cell.value);
      }
    }

    // Generate SQL
    let sql = '';
    for (const tableId in tables) {
      const tableName = cells[tableId].value;
      const columns = tables[tableId];

      if (!tableName) continue;
      // Clean table name
      const cleanTableName = tableName.replace(/\s+/g, '_');

      if (columns.length === 0) continue;

      sql += `CREATE TABLE IF NOT EXISTS ${cleanTableName} (\n`;
      const validColumns = [];
      for (const col of columns) {
        // Try to parse "Name: Type" or just "Name Type"
        // If just "Name", default to VARCHAR(255)
        let colName = col;
        let colType = 'VARCHAR(255)';

        // Remove any visibility symbols like + - #
        colName = colName.replace(/^[+\-#]\s*/, '');

        if (colName.includes(':')) {
          const parts = colName.split(':');
          colName = parts[0].trim();
          colType = parts[1].trim();
        } else if (colName.includes(' ')) {
          const parts = colName.split(/\s+/);
          colName = parts[0];
          colType = parts.slice(1).join(' ');
        }

        // Basic normalization for SQL types if needed, but trusting the diagram mostly
        validColumns.push(`    ${colName} ${colType}`);
      }
      sql += validColumns.join(',\n');
      sql += '\n);\n\n';
    }

    return sql;
  }

  private async executeSql(
    sql: string,
    dbConfig: DrawioToSqlToolParams['dbConfig'],
  ): Promise<string> {
    if (!dbConfig) return 'No DB Config provided.';

    if (dbConfig.type === 'mysql') {
      return this.executeMysql(sql, dbConfig);
    } else {
      return this.executePostgres(sql, dbConfig);
    }
  }

  private async executeMysql(
    sql: string,
    dbConfig: NonNullable<DrawioToSqlToolParams['dbConfig']>,
  ): Promise<string> {
    try {
      // eslint-disable-next-line import/no-internal-modules
      const mysql = await import('mysql2/promise');
      const connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port || 3306,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        multipleStatements: true, // Allow executing multiple statements
      });

      try {
        const [results] = await connection.query(sql);
        return `Successfully executed SQL. Results: ${JSON.stringify(results)}`;
      } finally {
        await connection.end();
      }
    } catch (e) {
      throw new Error(`MySQL Error: ${e}`);
    }
  }

  private async executePostgres(
    sql: string,
    dbConfig: NonNullable<DrawioToSqlToolParams['dbConfig']>,
  ): Promise<string> {
    try {
      // @ts-expect-error: pg types might be missing in some environments
      const pg = await import('pg');
      const { Client } = pg.default || pg;
      const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port || 5432,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
      });

      await client.connect();
      try {
        await client.query(sql);
        return 'Successfully executed SQL.';
      } finally {
        await client.end();
      }
    } catch (e) {
      throw new Error(`Postgres Error: ${e}`);
    }
  }
}

export class DrawioToSqlTool extends BaseDeclarativeTool<
  DrawioToSqlToolParams,
  ToolResult
> {
  static readonly Name = DRAWIO_TO_SQL_TOOL_NAME;

  constructor(_config: Config, messageBus?: MessageBus) {
    super(
      DrawioToSqlTool.Name,
      'DrawioToSql',
      'Extracts SQL CREATE TABLE statements from a .drawio file and optionally executes them on a database. Assumes a simple diagram structure where Tables are parent containers and Columns are child items.',
      Kind.Fetch, // Or Execute? Kind.Execute makes sense if it writes to DB. Kind.Fetch/Read if just reading.
      // Since it CAN execute, maybe Execute? But primarily it's a converter.
      // Let's use Kind.Execute if we execute, but the tool framework requires one kind.
      // "Generate" isn't a kind. "Other"?
      // Let's go with "Execute" because of the side effect option.
      {
        properties: {
          filePath: {
            type: 'string',
            description: 'Absolute path to the .drawio file.',
          },
          dbConfig: {
            type: 'object',
            properties: {
              type: { enum: ['mysql', 'postgres'] },
              host: { type: 'string' },
              port: { type: 'number' },
              user: { type: 'string' },
              password: { type: 'string' },
              database: { type: 'string' },
            },
            required: ['type', 'host', 'user', 'database'],
            description:
              'Optional database connection details to create tables immediately.',
          },
          execute: {
            type: 'boolean',
            description:
              'If true and dbConfig is provided, executes the generated SQL.',
          },
        },
        required: ['filePath'],
        type: 'object',
      },
      true, // isOutputMarkdown
      false,
      messageBus,
    );
  }

  protected createInvocation(
    params: DrawioToSqlToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<DrawioToSqlToolParams, ToolResult> {
    return new DrawioToSqlToolInvocation(
      params,
      messageBus,
      _toolName,
      _toolDisplayName,
    );
  }
}
