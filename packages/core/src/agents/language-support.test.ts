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

import { renderLanguage } from '../prompts/snippets.js';

describe('Agent Language Support', () => {
  const createMockConfig = (language: string) =>
    ({
      language,
      getModel: () => 'codefly-pro',
      getLanguage: () => language,
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
      const language = 'zh-CN';
      const config = createMockConfig(language);
      const agent = factory(config);
      // The executor appends the language instruction to the system prompt
      const finalPrompt =
        (agent.promptConfig?.systemPrompt || '') +
        '\n' +
        renderLanguage(language);
      expect(finalPrompt).toContain(
        'CRITICAL: You MUST explicitly adhere to the users language preference',
      );
      expect(finalPrompt).toContain(language);
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
