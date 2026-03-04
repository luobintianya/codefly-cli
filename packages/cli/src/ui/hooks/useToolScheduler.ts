/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Config,
  type ToolCallRequestInfo,
  type ToolCall,
  type CompletedToolCall,
  type EditorType,
} from '@codeflyai/codefly-core';
import type React from 'react';
import { useReactToolScheduler } from './useReactToolScheduler.js';
import { useToolExecutionScheduler } from './useToolExecutionScheduler.js';

// Re-exporting types compatible with hook expectations
export type ScheduleFn = (
  request: ToolCallRequestInfo | ToolCallRequestInfo[],
  signal: AbortSignal,
) => Promise<CompletedToolCall[]>;

export type MarkToolsAsSubmittedFn = (callIds: string[]) => void;
export type CancelAllFn = (signal: AbortSignal) => void;

/**
 * The shape expected by useCodeflyStream.
 * It matches the Core ToolCall structure + the UI metadata flag.
 */
export type TrackedToolCall = ToolCall & {
  responseSubmittedToCodefly?: boolean;
};

// Narrowed types for specific statuses (used by useCodeflyStream)
export type TrackedScheduledToolCall = Extract<
  TrackedToolCall,
  { status: 'scheduled' }
>;
export type TrackedValidatingToolCall = Extract<
  TrackedToolCall,
  { status: 'validating' }
>;
export type TrackedWaitingToolCall = Extract<
  TrackedToolCall,
  { status: 'awaiting_approval' }
>;
export type TrackedExecutingToolCall = Extract<
  TrackedToolCall,
  { status: 'executing' }
>;
export type TrackedCompletedToolCall = Extract<
  TrackedToolCall,
  { status: 'success' | 'error' }
>;
export type TrackedCancelledToolCall = Extract<
  TrackedToolCall,
  { status: 'cancelled' }
>;

/**
 * Facade tool scheduler hook that delegates to either the legacy or modern
 * implementation based on the feature flag.
 */
export function useToolScheduler(
  onComplete: (tools: CompletedToolCall[]) => Promise<void>,
  config: Config,
  getPreferredEditor: () => EditorType | undefined,
): [
  TrackedToolCall[],
  ScheduleFn,
  MarkToolsAsSubmittedFn,
  React.Dispatch<React.SetStateAction<TrackedToolCall[]>>,
  CancelAllFn,
  number,
] {
  const isEventDriven = config.isEventDrivenSchedulerEnabled();

  const useImpl = isEventDriven
    ? useToolExecutionScheduler
    : useReactToolScheduler;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return useImpl(onComplete, config, getPreferredEditor) as unknown as [
    TrackedToolCall[],
    ScheduleFn,
    MarkToolsAsSubmittedFn,
    React.Dispatch<React.SetStateAction<TrackedToolCall[]>>,
    CancelAllFn,
    number,
  ];
}
