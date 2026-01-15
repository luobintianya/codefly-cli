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

export class DrawioToSqlToolInvocation extends BaseToolInvocation<
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
    const xmlContent = content.trim();

    // Check if it's a bare base64 string (sometimes happens if just the deflated part is passed)
    if (!xmlContent.startsWith('<') && !xmlContent.includes(' ')) {
      try {
        const buffer = Buffer.from(xmlContent, 'base64');
        const decompressed = await inflateRawAsync(buffer);
        return decodeURIComponent(decompressed.toString());
      } catch (_e) {
        // Not a valid compressed string, assume it's just text
      }
    }

    if (xmlContent.includes('<mxfile')) {
      // Extract diagram content
      const diagramMatch = xmlContent.match(/<diagram[^>]*>(.*?)<\/diagram>/s);
      if (diagramMatch) {
        const raw = diagramMatch[1].trim();
        // If inside diagram tags it looks like base64
        if (raw && !raw.startsWith('<')) {
          try {
            const buffer = Buffer.from(raw, 'base64');
            const decompressed = await inflateRawAsync(buffer);
            return decodeURIComponent(decompressed.toString());
          } catch (_e) {
            // fallback: it might be uncompressed text that just doesn't start with <
            return raw;
          }
        } else {
          // It might be raw XML inside diagram
          return raw;
        }
      }
    }

    return xmlContent;
  }

  private parseDrawioToSql(xml: string): string {
    const cells: Record<
      string,
      {
        id: string;
        parent?: string;
        value?: string;
        style?: string;
        vertex?: string;
        edge?: string;
        source?: string;
        target?: string;
      }
    > = {};

    // Robust regex to match tags and attributes
    // Matches <mxCell ... /> or <mxCell ...>...</mxCell>
    // We strictly look for the opening tag and attributes
    const cellRegex = /<mxCell\s+([^>]*?)(\/?>)/gs;
    const attrRegex = /([a-z0-9]+)="([^"]*)"/gi;

    let match;
    while ((match = cellRegex.exec(xml)) !== null) {
      const attrsStr = match[1];
      const attrs: Record<string, string> = {};
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }

      if (attrs['id']) {
        if (attrs['value']) {
          attrs['value'] = this.cleanValue(attrs['value']);
        }
        cells[attrs['id']] = {
          id: attrs['id'],
          parent: attrs['parent'],
          value: attrs['value'],
          style: attrs['style'],
          vertex: attrs['vertex'],
          edge: attrs['edge'],
          source: attrs['source'],
          target: attrs['target'],
        };
      }
    }

    // Identify Tables
    // A table is:
    // 1. A vertex (vertex="1")
    // 2. Has a non-empty value (Name)
    // 3. AND (Is a known table style like "swimlane" OR "table" OR doesn't have a parent that is a table)
    // To simplify: We'll assume any vertex with children that are "columns" is a table.
    // Or any vertex with style "swimlane".

    const possibleTables: Set<string> = new Set();
    const parentToChildren: Record<string, string[]> = {};

    for (const id in cells) {
      const cell = cells[id];
      if (cell.parent) {
        if (!parentToChildren[cell.parent]) parentToChildren[cell.parent] = [];
        parentToChildren[cell.parent].push(id);
      }

      if (cell.vertex === '1' && cell.value) {
        // Heuristic for table:
        // - Explicit swimlane
        // - OR just a box that ends up having children columns
        if (
          cell.style &&
          (cell.style.includes('swimlane') || cell.style.includes('table'))
        ) {
          possibleTables.add(id);
        }
      }
    }

    // Also look for parents that have children which look like columns
    for (const parentId in parentToChildren) {
      if (
        cells[parentId] &&
        cells[parentId].value &&
        cells[parentId].vertex === '1'
      ) {
        possibleTables.add(parentId);
      }
    }

    const tables: Record<string, string[]> = {};

    for (const tableId of possibleTables) {
      const childrenIds = parentToChildren[tableId] || [];

      // Filter children to find columns
      // Columns are vertices with values, usually not edges
      const columns: string[] = [];
      for (const childId of childrenIds) {
        const child = cells[childId];
        if (child.vertex === '1' && child.value) {
          columns.push(child.value);
        }
      }

      if (columns.length > 0) {
        tables[tableId] = columns;
      }
    }

    // Generate SQL
    let sql = '';
    const tableIdToName: Record<string, string> = {};

    // CREATE TABLE statements
    for (const tableId in tables) {
      const tableName = cells[tableId].value!;

      // Filter out Enum/Dictionary tables
      // Heuristic: Check if name contains "Enum" or "Dict"
      if (tableName.match(/(enum|dict|dictionary)/i)) {
        continue;
      }
      const cleanTableName = tableName.replace(/\s+/g, '_');
      tableIdToName[tableId] = cleanTableName;

      sql += `CREATE TABLE IF NOT EXISTS ${cleanTableName} (\n`;
      const validColumns = [];
      for (const col of tables[tableId]) {
        let colName = col;
        let colType = 'VARCHAR(255)';

        // Remove visibility markers
        colName = colName.replace(/^[+\-#]\s*/, '');

        // Parse "Name: Type" or "Name Type"
        if (colName.includes(':')) {
          const parts = colName.split(':');
          colName = parts[0].trim();
          if (parts[1]) colType = parts[1].trim();
        } else if (colName.includes(' ')) {
          const parts = colName.split(/\s+/);
          colName = parts[0];
          if (parts.length > 1) colType = parts.slice(1).join(' ');
        }
        validColumns.push(`    ${colName} ${colType}`);
      }
      sql += validColumns.join(',\n');
      sql += '\n);\n\n';
    }

    // Constraint / Foreign Keys from Edges
    for (const id in cells) {
      const cell = cells[id];
      // Check if it is an edge connecting two tables
      if (cell.edge === '1' && cell.source && cell.target) {
        const sourceTable = tableIdToName[cell.source];
        const targetTable = tableIdToName[cell.target];

        if (sourceTable && targetTable) {
          // Assumption: Arrow points from Foreign Key (Child) to Primary Key (Parent)
          // Source = Table with FK
          // Target = Table with PK

          // Construct a basic FK name
          const constraintName = `fk_${sourceTable}_${targetTable}`;
          // We default to assuming the FK column is explicit or follows convention like target_id
          // But without analyzing columns we can't be sure of the column name.
          // However, often the line connects specifically to a column, not just the table.
          // If source points to a Column cell, we should resolve that to the Table + Column.

          // Let's resolve source/target to their ultimate tables
          const realSourceTableId = this.findTableForCell(
            cell.source,
            tables,
            cells,
          );
          const realTargetTableId = this.findTableForCell(
            cell.target,
            tables,
            cells,
          );

          if (
            realSourceTableId &&
            realTargetTableId &&
            realSourceTableId !== realTargetTableId
          ) {
            const sourceTblName = tableIdToName[realSourceTableId];
            const targetTblName = tableIdToName[realTargetTableId];

            // Try to guess FK column name
            // If source was a column, use that name.
            // If source was the table, guess `target_id` or `targetId`
            let fkColumn = `${targetTblName.toLowerCase()}_id`; // default guess

            if (realSourceTableId !== cell.source) {
              // Source was a column!
              const colVal = cells[cell.source].value;
              if (colVal) {
                // Clean up column name
                fkColumn = colVal.split(/[:\s]/)[0].replace(/^[+\-#]\s*/, '');
              }
            }

            sql += `ALTER TABLE ${sourceTblName}\n`;
            sql += `ADD CONSTRAINT ${constraintName}\n`;
            sql += `FOREIGN KEY (${fkColumn}) REFERENCES ${targetTblName}(id);\n\n`;
          }
        }
      }
    }

    return sql;
  }

  private findTableForCell(
    cellId: string,
    tables: Record<string, string[]>,
    cells: Record<string, { parent?: string }>,
  ): string | undefined {
    if (tables[cellId]) return cellId;
    const cell = cells[cellId];
    if (cell && cell.parent && tables[cell.parent]) return cell.parent;
    return undefined;
  }

  private cleanValue(val: string): string {
    return val
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
      .replace(/<\/?(div|p|span|br|b|i|u|font|strong|em|h[1-6])[^>]*>/gi, '')
      .replaceAll('&nbsp;', ' ')
      .trim();
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
