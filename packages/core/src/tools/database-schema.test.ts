/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DatabaseSchemaToolParams } from './database-schema.js';
import { DatabaseSchemaTool } from './database-schema.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';

// Mock Config
vi.mock('../config/config.js');

describe('DatabaseSchemaTool', () => {
  const abortSignal = new AbortController().signal;
  let tool: DatabaseSchemaTool;

  const mockMysqlExecute = vi.fn();
  const mockMysqlEnd = vi.fn();
  const mockMysqlCreateConnection = vi.fn();

  const mockPgQuery = vi.fn();
  const mockPgEnd = vi.fn();
  const mockPgConnect = vi.fn();
  const mockPgClient = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock mysql2
    mockMysqlEnd.mockResolvedValue(undefined);
    mockMysqlCreateConnection.mockResolvedValue({
      execute: mockMysqlExecute,
      end: mockMysqlEnd,
    });
    vi.doMock('mysql2/promise', () => ({
      createConnection: mockMysqlCreateConnection,
    }));

    // Mock pg
    mockPgEnd.mockResolvedValue(undefined);
    mockPgConnect.mockResolvedValue(undefined);
    mockPgClient.mockImplementation(() => ({
      query: mockPgQuery,
      connect: mockPgConnect,
      end: mockPgEnd,
    }));
    // Note: DatabaseSchemaTool uses import('pg') so we need to mock the default export
    vi.doMock('pg', () => ({
      default: { Client: mockPgClient },
      Client: mockPgClient,
    }));

    const mockConfigInstance = {} as unknown as Config;
    tool = new DatabaseSchemaTool(mockConfigInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('build', () => {
    it('should return an invocation for valid params', () => {
      const params: DatabaseSchemaToolParams = {
        type: 'mysql',
        host: 'localhost',
        user: 'root',
        database: 'test_db',
      };
      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);
    });
  });

  describe('execute', () => {
    it('should fetch MySQL schema successfully', async () => {
      const params: DatabaseSchemaToolParams = {
        type: 'mysql',
        host: 'localhost',
        user: 'root',
        database: 'test_db',
      };

      const mockRows = [
        {
          table_name: 'users',
          column_name: 'id',
          data_type: 'int',
          is_nullable: 'NO',
          column_key: 'PRI',
        },
        {
          table_name: 'users',
          column_name: 'name',
          data_type: 'varchar',
          is_nullable: 'YES',
          column_key: '',
        },
      ];
      mockMysqlExecute.mockResolvedValue([mockRows]);

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      // Verify connection was created with correct params
      expect(mockMysqlCreateConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: undefined,
        database: 'test_db',
      });

      // Verify query was executed
      expect(mockMysqlExecute).toHaveBeenCalled();

      // Verify output format
      expect(result.llmContent).toContain('Table: users');
      expect(result.llmContent).toContain('- id (int) [PRI]');
      expect(result.llmContent).toContain('- name (varchar) NULL');
      expect(result.returnDisplay).toBe('Fetched schema for test_db');
    });

    it('should fetch PostgreSQL schema successfully', async () => {
      const params: DatabaseSchemaToolParams = {
        type: 'postgres',
        host: 'localhost',
        user: 'postgres',
        database: 'pg_test_db',
      };

      const mockRows = [
        {
          table_name: 'products',
          column_name: 'id',
          data_type: 'integer',
          is_nullable: 'NO',
        },
        {
          table_name: 'products',
          column_name: 'price',
          data_type: 'numeric',
          is_nullable: 'YES',
        },
      ];
      mockPgQuery.mockResolvedValue({ rows: mockRows });

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      // Verify client was initialized with correct params
      expect(mockPgClient).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: undefined,
        database: 'pg_test_db',
      });

      // Verify methods called
      expect(mockPgConnect).toHaveBeenCalled();
      expect(mockPgQuery).toHaveBeenCalled();
      expect(mockPgEnd).toHaveBeenCalled();

      // Verify output format
      expect(result.llmContent).toContain('Table: products');
      expect(result.llmContent).toContain('- id (integer)');
      expect(result.llmContent).toContain('- price (numeric) NULL');
      expect(result.returnDisplay).toBe('Fetched schema for pg_test_db');
    });

    it('should handle MySQL errors', async () => {
      const params: DatabaseSchemaToolParams = {
        type: 'mysql',
        host: 'localhost',
        user: 'root',
        database: 'test_db',
      };

      const error = new Error('Connection failed');
      mockMysqlCreateConnection.mockRejectedValue(error);

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
      expect(result.llmContent).toContain(
        'Error fetching schema: Error: Connection failed',
      );
    });

    it('should handle PostgreSQL errors', async () => {
      const params: DatabaseSchemaToolParams = {
        type: 'postgres',
        host: 'localhost',
        user: 'postgres',
        database: 'pg_test_db',
      };

      const error = new Error('Query failed');
      mockPgQuery.mockRejectedValue(error);

      const invocation = tool.build(params);
      const result = await invocation.execute(abortSignal);

      expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
      expect(result.llmContent).toContain(
        'Error fetching schema: Error: Query failed',
      );
    });

    it('should throw validation error for unsupported database type', () => {
      const params = {
        type: 'mongo', // Invalid type cast to force error
        host: 'localhost',
        user: 'root',
        database: 'test_db',
      } as unknown as DatabaseSchemaToolParams;

      expect(() => tool.build(params)).toThrow(
        /params\/type must be equal to one of the allowed values/,
      );
    });
  });
});
