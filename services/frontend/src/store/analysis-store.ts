import { create } from 'zustand';

import {
  buildReplayEvents,
  nodeSnapshot,
  normalizeAnalysisState,
  normalizeNodeName,
} from '@/lib/analysis-helpers';
import { makeRuntimeIssue, parseApiError } from '@/lib/api';
import { buildApiUrl } from '@/lib/api-base';
import { isFakeDeployment } from '@/lib/runtime-config';
import {
  type AnalysisEvent,
  type AnalysisJob,
  type AnalysisStateResult,
  type AppMode,
  defaultReplayPath,
  type DemoCatalogItem,
  type NodeName,
  type RuntimeIssue,
} from '@/types/analysis';

let liveEventSource: EventSource | null = null;

function closeEventSource() {
  liveEventSource?.close();
  liveEventSource = null;
}

type AnalysisStore = {
  mode: AppMode;
  audioFile: File | null;
  scenario: string;
  transcriptOverride: string;
  replayPath: string;
  demoCatalog: DemoCatalogItem[];
  isDemoCatalogLoading: boolean;
  isDemoBackendAvailable: boolean;
  job: AnalysisJob | null;
  events: AnalysisEvent[];
  activeNode: NodeName;
  activePayload: Record<string, unknown> | null;
  finalState: AnalysisStateResult | null;
  replayCursor: number;
  isReplayPlaying: boolean;
  isSubmitting: boolean;
  error: RuntimeIssue | null;
  navigationTarget: string | null;
  pipelineScrollTarget: string | null;
  consumeNavigationTarget: () => string | null;
  consumePipelineScrollTarget: () => string | null;
  dismissError: () => void;
  switchMode: (mode: AppMode) => void;
  setAudioFile: (file: File | null) => void;
  setScenario: (scenario: string) => void;
  setTranscriptOverride: (value: string) => void;
  setReplayPath: (value: string) => void;
  loadDemoCatalog: () => Promise<void>;
  selectReplayDemo: (item: DemoCatalogItem) => void;
  launchDemoReplay: (item: DemoCatalogItem) => Promise<void>;
  launchDemoLive: (item: DemoCatalogItem) => Promise<void>;
  setReplayPlaying: (value: boolean) => void;
  toggleReplayPlayback: () => void;
  setReplayCursor: (index: number) => void;
  stepReplay: (direction: -1 | 1) => void;
  seekReplay: (target: 'first' | 'last') => void;
  selectNode: (node: NodeName) => void;
  selectTimelineEvent: (event: AnalysisEvent) => void;
  advanceReplayPlayback: () => void;
  submitLiveRun: () => Promise<void>;
  loadReplay: () => Promise<void>;
  cleanup: () => void;
};

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  mode: 'live',
  audioFile: null,
  scenario: 'presentation',
  transcriptOverride: '',
  replayPath: defaultReplayPath,
  demoCatalog: [],
  isDemoCatalogLoading: false,
  isDemoBackendAvailable: false,
  job: null,
  events: [],
  activeNode: 'input',
  activePayload: null,
  finalState: null,
  replayCursor: 0,
  isReplayPlaying: false,
  isSubmitting: false,
  error: null,
  navigationTarget: null,
  pipelineScrollTarget: null,

  consumeNavigationTarget: () => {
    const target = get().navigationTarget;
    if (target) {
      set({ navigationTarget: null });
    }
    return target;
  },

  consumePipelineScrollTarget: () => {
    const target = get().pipelineScrollTarget;
    if (target) {
      set({ pipelineScrollTarget: null });
    }
    return target;
  },

  dismissError: () => set({ error: null }),

  switchMode: (mode) => {
    closeEventSource();
    set({
      mode,
      job: null,
      events: [],
      activeNode: 'input',
      activePayload: null,
      finalState: null,
      replayCursor: 0,
      isReplayPlaying: false,
      isSubmitting: false,
      error: null,
      navigationTarget: '/run',
      pipelineScrollTarget: null,
    });
  },

  setAudioFile: (file) => set({ audioFile: file }),
  setScenario: (scenario) => set({ scenario }),
  setTranscriptOverride: (transcriptOverride) => set({ transcriptOverride }),
  setReplayPath: (replayPath) => set({ replayPath }),
  loadDemoCatalog: async () => {
    if (!isFakeDeployment) {
      set({
        demoCatalog: [],
        isDemoBackendAvailable: false,
        isDemoCatalogLoading: false,
      });
      return;
    }

    const { isDemoCatalogLoading, replayPath } = get();
    if (isDemoCatalogLoading) {
      return;
    }

    set({ isDemoCatalogLoading: true });
    try {
      const response = await fetch(buildApiUrl('/api/v1/demos'));
      if (!response.ok) {
        set({
          demoCatalog: [],
          isDemoBackendAvailable: false,
          isDemoCatalogLoading: false,
        });
        return;
      }

      const payload = (await response.json()) as { items?: DemoCatalogItem[] };
      const items = Array.isArray(payload.items)
        ? payload.items.filter(
            (item): item is DemoCatalogItem =>
              typeof item?.id === 'string' &&
              typeof item?.label === 'string' &&
              typeof item?.replay_path === 'string' &&
              typeof item?.audio_filename === 'string'
          )
        : [];
      const first = items[0];
      const nextReplayPath =
        replayPath === defaultReplayPath && first
          ? first.replay_path
          : replayPath;
      const nextScenario =
        replayPath === defaultReplayPath && first ? first.id : get().scenario;

      set({
        demoCatalog: items,
        isDemoBackendAvailable: items.length > 0,
        isDemoCatalogLoading: false,
        replayPath: nextReplayPath,
        scenario: nextScenario,
      });
    } catch {
      set({
        demoCatalog: [],
        isDemoBackendAvailable: false,
        isDemoCatalogLoading: false,
      });
    }
  },
  selectReplayDemo: (item) =>
    set({
      replayPath: item.replay_path,
      scenario: item.id,
    }),
  launchDemoReplay: async (item) => {
    set({
      mode: 'replay',
      replayPath: item.replay_path,
      scenario: item.id,
      error: null,
    });
    await get().loadReplay();
  },
  launchDemoLive: async (item) => {
    set({
      mode: 'live',
      scenario: item.id,
      error: null,
    });
    await get().submitLiveRun();
  },
  setReplayPlaying: (isReplayPlaying) => set({ isReplayPlaying }),

  toggleReplayPlayback: () => {
    const { mode, events, replayCursor, isReplayPlaying } = get();
    if (mode !== 'replay' || !events.length) {
      return;
    }
    if (replayCursor >= events.length - 1) {
      set({ replayCursor: 0, isReplayPlaying: true });
      get().setReplayCursor(0);
      return;
    }
    set({ isReplayPlaying: !isReplayPlaying });
  },

  setReplayCursor: (index) => {
    const { events, mode } = get();
    const nextIndex = Math.max(
      0,
      Math.min(index, Math.max(events.length - 1, 0))
    );
    const nextEvent = events[nextIndex];
    if (mode !== 'replay') {
      set({ replayCursor: nextIndex });
      return;
    }
    set((state) => {
      const replayJob = nextEvent?.payload?.job as AnalysisJob | undefined;
      return {
        replayCursor: nextIndex,
        activeNode: nextEvent?.node
          ? normalizeNodeName(nextEvent.node)
          : state.activeNode,
        activePayload: nextEvent?.payload || state.activePayload,
        job: replayJob || state.job,
      };
    });
  },

  stepReplay: (direction) => {
    const { replayCursor } = get();
    set({ isReplayPlaying: false });
    get().setReplayCursor(replayCursor + direction);
  },

  seekReplay: (target) => {
    const { events } = get();
    set({ isReplayPlaying: false });
    get().setReplayCursor(
      target === 'first' ? 0 : Math.max(events.length - 1, 0)
    );
  },

  selectNode: (node) => {
    const { events, finalState, mode } = get();
    const matchedEvent = [...events]
      .reverse()
      .find((event) => event.node === node);
    const nodePayload = finalState
      ? {
          node_snapshot: nodeSnapshot(node, finalState),
          state: finalState,
        }
      : matchedEvent?.payload || null;

    set({
      isReplayPlaying: mode === 'replay' ? false : get().isReplayPlaying,
      activeNode: node,
      activePayload: nodePayload,
    });
  },

  selectTimelineEvent: (event) => {
    const { events, mode, activeNode } = get();
    const eventIndex = events.findIndex(
      (candidate) =>
        candidate.created_at === event.created_at &&
        candidate.event_type === event.event_type &&
        candidate.node === event.node
    );

    if (mode === 'replay' && eventIndex >= 0) {
      set({ isReplayPlaying: false });
      get().setReplayCursor(eventIndex);
      return;
    }

    set({
      activeNode: event.node ? normalizeNodeName(event.node) : activeNode,
      activePayload: event.payload,
    });
  },

  advanceReplayPlayback: () => {
    const { mode, isReplayPlaying, events, replayCursor } = get();
    if (mode !== 'replay' || !isReplayPlaying || !events.length) {
      return;
    }
    if (replayCursor >= events.length - 1) {
      set({ isReplayPlaying: false });
      return;
    }
    get().setReplayCursor(replayCursor + 1);
  },

  submitLiveRun: async () => {
    const { audioFile, scenario, transcriptOverride } = get();
    if (!audioFile && !isFakeDeployment) {
      set({
        error: makeRuntimeIssue(
          'Please select an audio file first.',
          'warning'
        ),
      });
      return;
    }

    closeEventSource();
    set({
      mode: 'live',
      job: null,
      events: [],
      activeNode: 'input',
      activePayload: null,
      finalState: null,
      replayCursor: 0,
      isReplayPlaying: false,
      isSubmitting: true,
      error: null,
      navigationTarget: '/pipeline?view=overview',
      pipelineScrollTarget: 'pipeline-node-map',
    });

    const formData = new FormData();
    if (audioFile) {
      formData.append('audio', audioFile);
    }
    formData.append('scenario', scenario);
    if (!isFakeDeployment && transcriptOverride.trim()) {
      formData.append('transcript_override', transcriptOverride.trim());
    }

    try {
      const response = await fetch(buildApiUrl('/api/v1/analyses'), {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw await parseApiError(response, 'Failed to submit analysis');
      }

      const nextJob = (await response.json()) as AnalysisJob;
      set({
        job: nextJob,
        activeNode: 'input',
      });

      if (!nextJob.events_url) {
        set({
          error: makeRuntimeIssue(
            'Missing events URL for live run.',
            'warning'
          ),
          isSubmitting: false,
        });
        return;
      }

      closeEventSource();
      const source = new EventSource(buildApiUrl(nextJob.events_url));
      liveEventSource = source;

      const handleEvent = (rawEvent: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(rawEvent.data) as AnalysisEvent;
          const incomingJob = parsed.payload?.job as AnalysisJob | undefined;
          const result = normalizeAnalysisState(parsed.payload?.result);
          const state = normalizeAnalysisState(parsed.payload?.state);

          set((current) => ({
            events: [...current.events, parsed],
            activeNode: parsed.node
              ? normalizeNodeName(parsed.node)
              : current.activeNode,
            activePayload: parsed.payload ?? null,
            job: incomingJob || current.job,
            finalState: result || state || current.finalState,
            isSubmitting: false,
          }));

          if (parsed.event_type === 'analysis_completed') {
            set({ navigationTarget: '/results' });
            source.close();
            liveEventSource = null;
          }
          if (parsed.event_type === 'analysis_failed') {
            set({
              error: makeRuntimeIssue(
                parsed.message || 'Analysis failed.',
                'destructive',
                {
                  code:
                    typeof parsed.payload?.code === 'string'
                      ? parsed.payload.code
                      : undefined,
                  requestId:
                    parsed.request_id ||
                    (typeof parsed.payload?.request_id === 'string'
                      ? parsed.payload.request_id
                      : undefined),
                  traceId:
                    parsed.trace_id ||
                    (typeof parsed.payload?.trace_id === 'string'
                      ? parsed.payload.trace_id
                      : undefined),
                }
              ),
            });
            source.close();
            liveEventSource = null;
          }
        } catch {
          set({
            error: makeRuntimeIssue(
              'Failed to parse an SSE event from the backend.',
              'warning'
            ),
          });
        }
      };

      [
        'job_created',
        'job_running',
        'workflow_started',
        'workflow_finished',
        'node_started',
        'node_completed',
        'substep_started',
        'substep_completed',
        'node_failed',
        'analysis_completed',
        'analysis_failed',
      ].forEach((eventName) =>
        source.addEventListener(eventName, handleEvent as EventListener)
      );

      source.onerror = () => {
        set({
          error: makeRuntimeIssue(
            'SSE connection dropped. Check whether the backend is still running.',
            'warning'
          ),
          isSubmitting: false,
        });
        source.close();
        liveEventSource = null;
      };
    } catch (submitError) {
      set({
        error:
          typeof submitError === 'object' &&
          submitError !== null &&
          'message' in submitError
            ? (submitError as RuntimeIssue)
            : makeRuntimeIssue('Unknown error', 'destructive'),
        isSubmitting: false,
      });
    }
  },

  loadReplay: async () => {
    const { replayPath } = get();
    closeEventSource();
    set({
      mode: 'replay',
      job: null,
      events: [],
      activeNode: 'input',
      activePayload: null,
      finalState: null,
      replayCursor: 0,
      isReplayPlaying: false,
      isSubmitting: true,
      error: null,
      navigationTarget: '/pipeline?view=overview',
      pipelineScrollTarget: 'pipeline-node-map',
    });

    try {
      const response = await fetch(buildApiUrl('/api/v1/replays/load'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: replayPath }),
      });
      if (!response.ok) {
        throw await parseApiError(response, 'Failed to load replay');
      }

      const payload = (await response.json()) as {
        path: string;
        result: AnalysisStateResult;
      };
      const normalizedResult = normalizeAnalysisState(payload.result);
      if (!normalizedResult) {
        throw makeRuntimeIssue(
          'Replay payload did not include a valid result state.',
          'destructive'
        );
      }
      const replay = buildReplayEvents(normalizedResult, payload.path);
      const firstEvent = replay.events[0];

      set({
        finalState: normalizedResult,
        job: firstEvent?.payload?.job
          ? (firstEvent.payload.job as AnalysisJob)
          : replay.job,
        events: replay.events,
        replayCursor: 0,
        isReplayPlaying: false,
        activeNode: firstEvent?.node
          ? normalizeNodeName(firstEvent.node)
          : 'input',
        activePayload: firstEvent?.payload || null,
        isSubmitting: false,
      });
    } catch (replayError) {
      set({
        error:
          typeof replayError === 'object' &&
          replayError !== null &&
          'message' in replayError
            ? (replayError as RuntimeIssue)
            : makeRuntimeIssue('Unknown replay error', 'destructive'),
        isSubmitting: false,
      });
    }
  },

  cleanup: () => {
    closeEventSource();
  },
}));
