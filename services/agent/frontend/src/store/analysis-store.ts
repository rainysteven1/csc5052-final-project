import { create } from "zustand";

import {
  asRecord,
  buildReplayEvents,
  nodeSnapshot,
} from "@/lib/analysis-helpers";
import {
  defaultReplayPath,
  type AnalysisEvent,
  type AnalysisJob,
  type AnalysisStateResult,
  type AppMode,
  type NodeName,
} from "@/types/analysis";

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
  job: AnalysisJob | null;
  events: AnalysisEvent[];
  activeNode: NodeName;
  activePayload: Record<string, unknown> | null;
  finalState: AnalysisStateResult | null;
  replayCursor: number;
  isReplayPlaying: boolean;
  isSubmitting: boolean;
  error: string | null;
  navigationTarget: string | null;
  consumeNavigationTarget: () => string | null;
  switchMode: (mode: AppMode) => void;
  setAudioFile: (file: File | null) => void;
  setScenario: (scenario: string) => void;
  setTranscriptOverride: (value: string) => void;
  setReplayPath: (value: string) => void;
  setReplayPlaying: (value: boolean) => void;
  toggleReplayPlayback: () => void;
  setReplayCursor: (index: number) => void;
  stepReplay: (direction: -1 | 1) => void;
  seekReplay: (target: "first" | "last") => void;
  selectNode: (node: NodeName) => void;
  selectTimelineEvent: (event: AnalysisEvent) => void;
  advanceReplayPlayback: () => void;
  submitLiveRun: () => Promise<void>;
  loadReplay: () => Promise<void>;
  cleanup: () => void;
};

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  mode: "live",
  audioFile: null,
  scenario: "presentation",
  transcriptOverride: "",
  replayPath: defaultReplayPath,
  job: null,
  events: [],
  activeNode: "prepare_input",
  activePayload: null,
  finalState: null,
  replayCursor: 0,
  isReplayPlaying: false,
  isSubmitting: false,
  error: null,
  navigationTarget: null,

  consumeNavigationTarget: () => {
    const target = get().navigationTarget;
    if (target) {
      set({ navigationTarget: null });
    }
    return target;
  },

  switchMode: (mode) => {
    closeEventSource();
    set({
      mode,
      job: null,
      events: [],
      activeNode: "prepare_input",
      activePayload: null,
      finalState: null,
      replayCursor: 0,
      isReplayPlaying: false,
      isSubmitting: false,
      error: null,
      navigationTarget: "/run",
    });
  },

  setAudioFile: (file) => set({ audioFile: file }),
  setScenario: (scenario) => set({ scenario }),
  setTranscriptOverride: (transcriptOverride) => set({ transcriptOverride }),
  setReplayPath: (replayPath) => set({ replayPath }),
  setReplayPlaying: (isReplayPlaying) => set({ isReplayPlaying }),

  toggleReplayPlayback: () => {
    const { mode, events, replayCursor, isReplayPlaying } = get();
    if (mode !== "replay" || !events.length) {
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
    const nextIndex = Math.max(0, Math.min(index, Math.max(events.length - 1, 0)));
    const nextEvent = events[nextIndex];
    if (mode !== "replay") {
      set({ replayCursor: nextIndex });
      return;
    }
    set((state) => {
      const replayJob = nextEvent?.payload?.job as AnalysisJob | undefined;
      return {
        replayCursor: nextIndex,
        activeNode: (nextEvent?.node as NodeName) || state.activeNode,
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
    get().setReplayCursor(target === "first" ? 0 : Math.max(events.length - 1, 0));
  },

  selectNode: (node) => {
    const { events, finalState, mode } = get();
    const matchedIndex = events.findIndex((event) => event.node === node);
    const matchedEvent = matchedIndex >= 0 ? events[matchedIndex] : undefined;
    if (mode === "replay" && matchedIndex >= 0) {
      set({ isReplayPlaying: false });
      get().setReplayCursor(matchedIndex);
      return;
    }

    set({
      activeNode: node,
      activePayload: matchedEvent?.payload || (finalState ? { node_snapshot: nodeSnapshot(node, finalState) } : null),
    });
  },

  selectTimelineEvent: (event) => {
    const { events, mode, activeNode } = get();
    const eventIndex = events.findIndex(
      (candidate) =>
        candidate.created_at === event.created_at &&
        candidate.event_type === event.event_type &&
        candidate.node === event.node,
    );

    if (mode === "replay" && eventIndex >= 0) {
      set({ isReplayPlaying: false });
      get().setReplayCursor(eventIndex);
      return;
    }

    set({
      activeNode: (event.node as NodeName) || activeNode,
      activePayload: event.payload,
    });
  },

  advanceReplayPlayback: () => {
    const { mode, isReplayPlaying, events, replayCursor } = get();
    if (mode !== "replay" || !isReplayPlaying || !events.length) {
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
    if (!audioFile) {
      set({ error: "Please select an audio file first." });
      return;
    }

    closeEventSource();
    set({
      mode: "live",
      job: null,
      events: [],
      activeNode: "prepare_input",
      activePayload: null,
      finalState: null,
      replayCursor: 0,
      isReplayPlaying: false,
      isSubmitting: true,
      error: null,
      navigationTarget: "/pipeline",
    });

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("scenario", scenario);
    if (transcriptOverride.trim()) {
      formData.append("transcript_override", transcriptOverride.trim());
    }

    try {
      const response = await fetch("/api/v1/analyses", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const nextJob = (await response.json()) as AnalysisJob;
      set({
        job: nextJob,
        activeNode: (nextJob.current_node as NodeName) || "prepare_input",
      });

      if (!nextJob.events_url) {
        set({ error: "Missing events URL for live run.", isSubmitting: false });
        return;
      }

      closeEventSource();
      const source = new EventSource(nextJob.events_url);
      liveEventSource = source;

      const handleEvent = (rawEvent: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(rawEvent.data) as AnalysisEvent;
          const incomingJob = parsed.payload?.job as AnalysisJob | undefined;
          const result = asRecord(parsed.payload?.result) as AnalysisStateResult | null;
          const state = asRecord(parsed.payload?.state) as AnalysisStateResult | null;

          set((current) => ({
            events: [...current.events, parsed],
            activeNode: (parsed.node as NodeName) || current.activeNode,
            activePayload: parsed.payload ?? null,
            job: incomingJob || current.job,
            finalState: result || state || current.finalState,
            isSubmitting: false,
          }));

          if (parsed.event_type === "analysis_completed") {
            set({ navigationTarget: "/results" });
            source.close();
            liveEventSource = null;
          }
          if (parsed.event_type === "analysis_failed") {
            set({ error: parsed.message || "Analysis failed." });
            source.close();
            liveEventSource = null;
          }
        } catch {
          set({ error: "Failed to parse an SSE event from the backend." });
        }
      };

      [
        "job_created",
        "job_running",
        "workflow_started",
        "workflow_finished",
        "node_started",
        "node_completed",
        "node_failed",
        "analysis_completed",
        "analysis_failed",
      ].forEach((eventName) => source.addEventListener(eventName, handleEvent as EventListener));

      source.onerror = () => {
        set({ error: "SSE connection dropped. Check whether the backend is still running.", isSubmitting: false });
        source.close();
        liveEventSource = null;
      };
    } catch (submitError) {
      set({
        error: submitError instanceof Error ? submitError.message : "Unknown error",
        isSubmitting: false,
      });
    }
  },

  loadReplay: async () => {
    const { replayPath } = get();
    closeEventSource();
    set({
      mode: "replay",
      job: null,
      events: [],
      activeNode: "prepare_input",
      activePayload: null,
      finalState: null,
      replayCursor: 0,
      isReplayPlaying: false,
      isSubmitting: true,
      error: null,
      navigationTarget: "/pipeline",
    });

    try {
      const response = await fetch("/api/v1/replays/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: replayPath }),
      });
      if (!response.ok) {
        throw new Error(`Replay request failed: ${response.status}`);
      }

      const payload = (await response.json()) as { path: string; result: AnalysisStateResult };
      const replay = buildReplayEvents(payload.result, payload.path);
      const firstEvent = replay.events[0];

      set({
        finalState: payload.result,
        job: firstEvent?.payload?.job ? (firstEvent.payload.job as AnalysisJob) : replay.job,
        events: replay.events,
        replayCursor: 0,
        isReplayPlaying: false,
        activeNode: (firstEvent?.node as NodeName) || "prepare_input",
        activePayload: firstEvent?.payload || null,
        isSubmitting: false,
      });
    } catch (replayError) {
      set({
        error: replayError instanceof Error ? replayError.message : "Unknown replay error",
        isSubmitting: false,
      });
    }
  },

  cleanup: () => {
    closeEventSource();
  },
}));
