/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefinition } from './types.js';
import { GetInternalDocsTool } from '../tools/get-internal-docs.js';
import { CODEFLY_MODEL_ALIAS_FLASH } from '../config/models.js';
import { z } from 'zod';
import type { Config } from '../config/config.js';

const IntrospectionReportSchema = z.object({
  answer: z
    .string()
    .describe('The detailed answer to the user question about Codefly CLI.'),
  sources: z
    .array(z.string())
    .describe('The documentation files used to answer the question.'),
});

/**
 * An agent specialized in answering questions about Codefly CLI itself,
 * using its own documentation and runtime state.
 */
export const IntrospectionAgent = (
  config: Config,
): AgentDefinition<typeof IntrospectionReportSchema> => ({
  name: 'introspection_agent',
  kind: 'local',
  displayName: 'Introspection Agent',
  description:
    'Specialized in answering questions about yourself (Codefly CLI): features, documentation, and current runtime configuration.',
  inputConfig: {
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          description: 'The specific question about Codefly CLI.',
          type: 'string',
        },
      },
      required: ['question'],
    },
  },
  outputConfig: {
    outputName: 'report',
    description: 'The final answer and sources as a JSON object.',
    schema: IntrospectionReportSchema,
  },

  processOutput: (output) => JSON.stringify(output, null, 2),

  modelConfig: {
    model: CODEFLY_MODEL_ALIAS_FLASH,
    generateContentConfig: {
      temperature: 0.1,
      topP: 0.95,
    },
  },

  runConfig: {
    maxTimeMinutes: 3,
    maxTurns: 10,
  },

  toolConfig: {
    tools: [new GetInternalDocsTool(undefined)],
  },

  promptConfig: {
    query:
      'Your task is to answer the following question about Codefly CLI:\n' +
      '<question>\n' +
      '${question}\n' +
      '</question>',
    systemPrompt:
      "You are **Introspection Agent**, an expert on Codefly CLI. Your purpose is to provide accurate information about Codefly CLI's features, configuration, and current state.\n\n" +
      '### Runtime Context\n' +
      '- **CLI Version:** ${cliVersion}\n' +
      '- **Active Model:** ${activeModel}\n' +
      "- **Today's Date:** ${today}\n\n" +
      '### Instructions\n' +
      "1. **Explore Documentation**: Use the `get_internal_docs` tool to find answers. If you don't know where to start, call `get_internal_docs()` without arguments to see the full list of available documentation files.\n" +
      '2. **Be Precise**: Use the provided runtime context and documentation to give exact answers.\n' +
      '3. **Cite Sources**: Always include the specific documentation files you used in your final report.\n' +
      '4. **Non-Interactive**: You operate in a loop and cannot ask the user for more info. If the question is ambiguous, answer as best as you can with the information available.\n\n' +
      (config.language && config.language !== 'auto'
        ? `CRITICAL: You MUST respond in ${config.language}.\n`
        : '') +
      'You MUST call `complete_task` with a JSON report containing your `answer` and the `sources` you used.',
  },
});
