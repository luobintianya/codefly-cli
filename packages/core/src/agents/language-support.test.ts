/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { CodebaseInvestigatorAgent } from './codebase-investigator.js';
import { CliHelpAgent } from './cli-help-agent.js';
import { IntrospectionAgent } from './introspection-agent.js';
import type { Config } from '../config/config.js';

describe('Agent Language Support', () => {
  const createMockConfig = (language: string) =>
    ({
      language,
      getModel: () => 'gemini-pro',
      getToolRegistry: () => ({
        getAllToolNames: () => [],
      }),
      isAgentsEnabled: () => false,
      getMessageBus: () => ({}),
      isInteractive: () => false,
      getAgentRegistry: () => ({
        getDirectoryContext: () => '',
      }),
      getSkillManager: () => ({
        getSkills: () => [],
      }),
    }) as unknown as Config;

  const AGENTS = [
    { name: 'CodebaseInvestigatorAgent', factory: CodebaseInvestigatorAgent },
    { name: 'CliHelpAgent', factory: CliHelpAgent },
    { name: 'IntrospectionAgent', factory: IntrospectionAgent },
  ];

  it.each(AGENTS)(
    '$name should include language instruction when language is set',
    ({ factory }) => {
      const config = createMockConfig('zh-CN');
      const agent = factory(config);
      expect(agent.promptConfig?.systemPrompt).toContain(
        'CRITICAL: You MUST respond in zh-CN',
      );
    },
  );

  it.each(AGENTS)(
    '$name should NOT include language instruction when language is auto',
    ({ factory }) => {
      const config = createMockConfig('auto');
      const agent = factory(config);
      expect(agent.promptConfig?.systemPrompt).not.toContain(
        'CRITICAL: You MUST respond in',
      );
    },
  );
});
