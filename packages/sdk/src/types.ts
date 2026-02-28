/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content } from '@codeflyai/codefly-core';
import type { Tool } from './tool.js';
import type { SkillReference } from './skills.js';
import type { CodeflyCliAgent } from './agent.js';
import type { CodeflyCliSession } from './session.js';

export type SystemInstructions =
  | string
  | ((context: SessionContext) => string | Promise<string>);

export interface CodeflyCliAgentOptions {
  instructions: SystemInstructions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<Tool<any>>;
  skills?: SkillReference[];
  model?: string;
  cwd?: string;
  debug?: boolean;
  recordResponses?: string;
  fakeResponses?: string;
}

export interface AgentFilesystem {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
}

export interface AgentShellOptions {
  env?: Record<string, string>;
  timeoutSeconds?: number;
  cwd?: string;
}

export interface AgentShellResult {
  exitCode: number | null;
  output: string;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface AgentShell {
  exec(cmd: string, options?: AgentShellOptions): Promise<AgentShellResult>;
}

export interface SessionContext {
  sessionId: string;
  transcript: Content[];
  cwd: string;
  timestamp: string;
  fs: AgentFilesystem;
  shell: AgentShell;
  agent: CodeflyCliAgent;
  session: CodeflyCliSession;
}
