/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Config,
  ToolCallRequestInfo,
  OutputUpdateHandler,
  AllToolCallsCompleteHandler,
  ToolCallsUpdateHandler,
  ToolCall,
  EditorType,
  CompletedToolCall,
  ExecutingToolCall,
  ScheduledToolCall,
  ValidatingToolCall,
  WaitingToolCall,
  CancelledToolCall,
} from '@codeflyai/codefly-core';
import { CoreToolScheduler } from '@codeflyai/codefly-core';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';

export type ScheduleFn = (
  request: ToolCallRequestInfo | ToolCallRequestInfo[],
  signal: AbortSignal,
) => Promise<void>;
export type MarkToolsAsSubmittedFn = (callIds: string[]) => void;
export type CancelAllFn = (signal: AbortSignal) => void;

export type TrackedScheduledToolCall = ScheduledToolCall & {
  responseSubmittedToCodefly?: boolean;
};
export type TrackedValidatingToolCall = ValidatingToolCall & {
  responseSubmittedToCodefly?: boolean;
};
export type TrackedWaitingToolCall = WaitingToolCall & {
  responseSubmittedToCodefly?: boolean;
};
export type TrackedExecutingToolCall = ExecutingToolCall & {
  responseSubmittedToCodefly?: boolean;
  pid?: number;
};
export type TrackedCompletedToolCall = CompletedToolCall & {
  responseSubmittedToCodefly?: boolean;
};
export type TrackedCancelledToolCall = CancelledToolCall & {
  responseSubmittedToCodefly?: boolean;
};

export type TrackedToolCall =
  | TrackedScheduledToolCall
  | TrackedValidatingToolCall
  | TrackedWaitingToolCall
  | TrackedExecutingToolCall
  | TrackedCompletedToolCall
  | TrackedCancelledToolCall;

/**
 * Legacy scheduler implementation based on CoreToolScheduler callbacks.
 *
 * This is currently the default implementation used by useCodeflyStream.
 * It will be phased out once the event-driven scheduler migration is complete.
 */
export function useReactToolScheduler(
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
  const [toolCallsForDisplay, setToolCallsForDisplay] = useState<
    TrackedToolCall[]
  >([]);
  const [lastToolOutputTime, setLastToolOutputTime] = useState<number>(0);

  const onCompleteRef = useRef(onComplete);
  const getPreferredEditorRef = useRef(getPreferredEditor);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    getPreferredEditorRef.current = getPreferredEditor;
  }, [getPreferredEditor]);

  const outputUpdateHandler: OutputUpdateHandler = useCallback(
    (toolCallId, outputChunk) => {
      setLastToolOutputTime(Date.now());
      setToolCallsForDisplay((prevCalls) =>
        prevCalls.map((tc) => {
          if (tc.request.callId === toolCallId && tc.status === 'executing') {
            const executingTc = tc;
            return { ...executingTc, liveOutput: outputChunk };
          }
          return tc;
        }),
      );
    },
    [],
  );

  const allToolCallsCompleteHandler: AllToolCallsCompleteHandler = useCallback(
    async (completedToolCalls) => {
      await onCompleteRef.current(completedToolCalls);
    },
    [],
  );

  const toolCallsUpdateHandler: ToolCallsUpdateHandler = useCallback(
    (allCoreToolCalls: ToolCall[]) => {
      setToolCallsForDisplay((prevTrackedCalls) => {
        const prevCallsMap = new Map(
          prevTrackedCalls.map((c) => [c.request.callId, c]),
        );

        return allCoreToolCalls.map((coreTc): TrackedToolCall => {
          const existingTrackedCall = prevCallsMap.get(coreTc.request.callId);

          const responseSubmittedToCodefly =
            existingTrackedCall?.responseSubmittedToCodefly ?? false;

          if (coreTc.status === 'executing') {
            const liveOutput = (existingTrackedCall as TrackedExecutingToolCall)
              ?.liveOutput;
            return {
              ...coreTc,
              responseSubmittedToCodefly,
              liveOutput,
              pid: coreTc.pid,
            };
          } else {
            return {
              ...coreTc,
              responseSubmittedToCodefly,
            };
          }
        });
      });
    },
    [setToolCallsForDisplay],
  );

  const stableGetPreferredEditor = useCallback(
    () => getPreferredEditorRef.current(),
    [],
  );

  const scheduler = useMemo(
    () =>
      new CoreToolScheduler({
        outputUpdateHandler,
        onAllToolCallsComplete: allToolCallsCompleteHandler,
        onToolCallsUpdate: toolCallsUpdateHandler,
        getPreferredEditor: stableGetPreferredEditor,
        config,
      }),
    [
      config,
      outputUpdateHandler,
      allToolCallsCompleteHandler,
      toolCallsUpdateHandler,
      stableGetPreferredEditor,
    ],
  );

  const schedule: ScheduleFn = useCallback(
    (
      request: ToolCallRequestInfo | ToolCallRequestInfo[],
      signal: AbortSignal,
    ) => {
      setToolCallsForDisplay([]);
      return scheduler.schedule(request, signal);
    },
    [scheduler, setToolCallsForDisplay],
  );

  const markToolsAsSubmitted: MarkToolsAsSubmittedFn = useCallback(
    (callIdsToMark: string[]) => {
      setToolCallsForDisplay((prevCalls) =>
        prevCalls.map((tc) =>
          callIdsToMark.includes(tc.request.callId)
            ? { ...tc, responseSubmittedToCodefly: true }
            : tc,
        ),
      );
    },
    [],
  );

  const cancelAllToolCalls = useCallback(
    (signal: AbortSignal) => {
      scheduler.cancelAll(signal);
    },
    [scheduler],
  );

  return [
    toolCallsForDisplay,
    schedule,
    markToolsAsSubmitted,
    setToolCallsForDisplay,
    cancelAllToolCalls,
    lastToolOutputTime,
  ];
}
