/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import { DRAWIO_TO_SQL_TOOL_NAME } from './tool-names.js';
import { LlmRole } from '../telemetry/types.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { getResponseText } from '../utils/partUtils.js';

const inflateRawAsync = promisify(inflateRaw);

interface Box {
  id: string;
  text: string;
  children?: string[];
}

interface Relationship {
  source: string;
  target: string;
}

interface ExtractResult {
  boxes: Box[];
  relationships: Relationship[];
}

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
  private config: Config;

  constructor(
    params: DrawioToSqlToolParams,
    config: Config,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
    this.config = config;
  }

  getDescription(): string {
    return `Extracting SQL from ${this.params.filePath}${this.params.dbConfig && this.params.execute ? ' and executing it' : ''}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const rawContent = await fs.readFile(this.params.filePath, 'utf-8');
      const xmlContent = await this.decodeDrawio(rawContent);

      // Extract boxes and relationships from DrawIO
      const extractResult = this.extractDrawioStructure(xmlContent);

      // Prepare prompt for LLM to generate SQL
      const prompt = this.buildSqlGenerationPrompt(extractResult);

      const llmResponse = await this.config.getBaseLlmClient().generateContent({
        modelConfigKey: { model: this.config.getActiveModel() },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        systemInstruction: {
          text: 'You are a SQL generation expert. Generate complete and correct SQL CREATE TABLE and ALTER TABLE statements based on the provided DrawIO diagram structure.',
        },
        promptId: 'drawio-to-sql',
        role: LlmRole.UTILITY_TOOL,
        abortSignal: _signal,
      });

      // Extract SQL from LLM response
      const llmText = getResponseText(llmResponse) || '';
      const generatedSql = this.extractSqlFromResponse(llmText);

      // Count generated tables
      const generatedTableCount = this.countGeneratedTables(generatedSql);

      // Save SQL to same directory as DrawIO file
      const fileName = path.basename(this.params.filePath, '.drawio') + '.sql';
      const drawioDir = path.dirname(this.params.filePath);
      const sqlFilePath = path.join(drawioDir, fileName);
      await fs.writeFile(sqlFilePath, generatedSql, 'utf-8');

      // Build detailed output with statistics
      let detailedOutput = '## DrawIO 转 SQL 结果\n\n';
      detailedOutput += `### 识别统计\n\n`;
      detailedOutput += `- **识别到的方框数量**: ${extractResult.boxes.length}\n`;
      detailedOutput += `- **识别到的关系数量**: ${extractResult.relationships.length}\n`;
      detailedOutput += `- **LLM 生成的表数量**: ${generatedTableCount}\n\n`;

      detailedOutput += `### 识别到的方框\n\n`;
      extractResult.boxes.forEach((box: Box, idx: number) => {
        detailedOutput += `**${idx + 1}. ${box.text}**\n`;
        if (box.children && box.children.length > 0) {
          detailedOutput += `  - 子项数: ${box.children.length}\n`;
          box.children.forEach((child: string) => {
            detailedOutput += `    - ${child}\n`;
          });
        }
        detailedOutput += '\n';
      });

      detailedOutput += `### 识别到的关系\n\n`;
      extractResult.relationships.forEach((rel: Relationship, idx: number) => {
        detailedOutput += `**${idx + 1}.** ${rel.source} -> ${rel.target}\n`;
      });

      detailedOutput += '\n### LLM 生成的 SQL\n\n```sql\n';
      detailedOutput += generatedSql;
      detailedOutput += '\n```\n';

      return {
        llmContent: detailedOutput,
        returnDisplay: `从 ${path.basename(this.params.filePath)} 生成 SQL 并保存到 ${sqlFilePath}。识别了 ${extractResult.boxes.length} 个方框，${extractResult.relationships.length} 个关系，生成了 ${generatedTableCount} 个表。`,
      };
    } catch (error) {
      return {
        llmContent: `错误: ${error}`,
        returnDisplay: `错误: ${error}`,
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

  private extractDrawioStructure(xml: string): ExtractResult {
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

    const boxes: Box[] = [];
    const relationships: Relationship[] = [];
    const parentToChildren: Record<string, string[]> = {};

    for (const id in cells) {
      const cell = cells[id];
      if (cell.parent) {
        if (!parentToChildren[cell.parent]) parentToChildren[cell.parent] = [];
        parentToChildren[cell.parent].push(id);
      }
    }

    for (const id in cells) {
      const cell = cells[id];
      // Vertex with text = likely a box/table
      if (cell.vertex === '1' && cell.value) {
        const isLikelyBox =
          !cell.style?.includes('edge') &&
          !cell.style?.includes('arrow') &&
          (cell.style?.includes('swimlane') ||
            cell.style?.includes('table') ||
            (parentToChildren[id] && parentToChildren[id].length > 0));

        if (isLikelyBox || !cell.parent || cell.parent === '1') {
          const childrenIds = parentToChildren[id] || [];
          const childrenTexts = childrenIds
            .map((cid) => cells[cid].value)
            .filter((v): v is string => !!v);

          boxes.push({
            id,
            text: cell.value,
            children: childrenTexts,
          });
        }
      }

      // Edges = relationships
      if (cell.edge === '1' && cell.source && cell.target) {
        const sourceVal = this.findTextForCell(cell.source, cells);
        const targetVal = this.findTextForCell(cell.target, cells);

        if (sourceVal && targetVal) {
          relationships.push({
            source: sourceVal,
            target: targetVal,
          });
        }
      }
    }

    return { boxes, relationships };
  }

  private findTextForCell(
    cellId: string,
    cells: Record<string, { value?: string; parent?: string }>,
  ): string {
    const current = cells[cellId];
    if (current?.value) return current.value;
    if (current?.parent && cells[current.parent]) {
      return this.findTextForCell(current.parent, cells);
    }
    return cellId;
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

  private buildSqlGenerationPrompt(data: ExtractResult): string {
    let prompt = `Analyze the following structure extracted from a DrawIO diagram and generate SQL CREATE TABLE statements.

Found Boxes (Tables):
`;
    data.boxes.forEach((box) => {
      prompt += `- ${box.text}\n`;
      if (box.children && box.children.length > 0) {
        prompt += `  Columns/Properties: ${box.children.join(', ')}\n`;
      }
    });

    prompt += `\nFound Relationships:\n`;
    data.relationships.forEach((rel) => {
      prompt += `- ${rel.source} -> ${rel.target}\n`;
    });

    prompt += `
Instructions:
1. Identify likely tables from the boxes. Ignore boxes that don't look like tables (e.g. titles, notes).
2. Use the "Columns/Properties" line to extract: Column Name, Data Type, and Comment.
3. Any text after the name and type should be used as the Column Comment (e.g. "selectValue varchar Multiple Values" -> Name: selectValue, Type: VARCHAR, Comment: "Multiple Values"). Use COMMENT '...' syntax. Do not translate comments.
4. Use the relationships to generate FOREIGN KEY constraints.
5. If an entity looks like an Enum (e.g. contains "Enum" in name or simple list of values), create a dictionary table for it.
6. Create a new table for dictionary/enum types with columns 'code' and 'label'.
7. Table name using snake_case.
8. Output ONLY valid SQL statements.
`;
    return prompt;
  }

  private extractSqlFromResponse(text: string): string {
    // Extract code block if present
    const match =
      text.match(/```sql\n([\s\S]*?)\n```/) ||
      text.match(/```\n([\s\S]*?)\n```/);
    if (match) {
      return match[1];
    }
    return text;
  }

  private countGeneratedTables(sql: string): number {
    const matches = sql.match(/CREATE\s+TABLE/gi);
    return matches ? matches.length : 0;
  }
}

export class DrawioToSqlTool extends BaseDeclarativeTool<
  DrawioToSqlToolParams,
  ToolResult
> {
  static readonly Name = DRAWIO_TO_SQL_TOOL_NAME;
  private config: Config;

  constructor(config: Config, messageBus?: MessageBus) {
    super(
      DrawioToSqlTool.Name,
      'DrawioToSql',
      'Extracts SQL CREATE TABLE statements from a .drawio file and optionally executes them on a database. Assumes a simple diagram structure where Tables are parent containers and Columns are child items.',
      Kind.Fetch,
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
      messageBus,
      true,
    );
    this.config = config;
  }

  protected createInvocation(
    params: DrawioToSqlToolParams,
    messageBus?: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<DrawioToSqlToolParams, ToolResult> {
    return new DrawioToSqlToolInvocation(
      params,
      this.config,
      messageBus,
      _toolName,
      _toolDisplayName,
    );
  }
}
