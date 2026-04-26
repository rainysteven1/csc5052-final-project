# Node Consolidation Analysis

## 1. Background

The current SpeakSure++ runtime exposes **11 pipeline nodes** to the frontend:

1. `prepare_input`
2. `asr`
3. `segment`
4. `lexical`
5. `prosody`
6. `disfluency`
7. `context`
8. `merge_analysis`
9. `reasoning`
10. `feedback`
11. `serialize_result`

This level of granularity is technically accurate, but it is **too fine-grained for a demo-facing desktop UI**.

From a user-facing perspective, these 11 nodes are mixing together:

- infrastructure steps
- analysis branches
- synthesis steps
- export steps

As a result:

- the pipeline looks longer and more fragmented than it really is
- several nodes feel like "implementation details" rather than meaningful milestones
- the frontend has to visualize too many cards
- some nodes are parallel internals, but the UI currently makes them look like equally important top-level stages


## 2. Current State: Why 11 Nodes Feels Unreasonable

### 2.1 User mental model vs implementation model

Users do **not** naturally think in this sequence:

`prepare_input -> asr -> segment -> lexical -> prosody -> disfluency -> context -> merge_analysis -> reasoning -> feedback -> serialize_result`

They think in a much simpler way:

1. input comes in
2. system analyzes speech
3. system synthesizes results
4. system outputs feedback

The current 11-node model is therefore closer to a **developer workflow graph** than a **presentation workflow graph**.

### 2.2 Parallel analysis is over-exposed

`lexical`, `prosody`, `disfluency`, and `context` are all part of a single larger semantic stage:

- "multi-dimensional analysis"

Exposing all four as top-level nodes increases surface area without increasing clarity.

### 2.3 Merge and serialize are not first-class business milestones

`merge_analysis` and `serialize_result` are useful internally, but in the UI they are weaker milestones than:

- input
- analysis
- coaching
- output

### 2.4 Frontend complexity expands unnecessarily

The current 11-node exposure forces the frontend to maintain:

- 11 icons
- 11 accent styles
- 11 node detail mappings
- 11 replay snapshots
- 11 progress labels

This is costly for a course project demo and makes the UI look busier than necessary.


## 3. What Should Be Optimized

The consolidation goal should be:

- fewer top-level phases in the UI
- preserve technical traceability
- avoid losing backend observability
- keep replay and SSE understandable
- avoid rewriting the whole workflow engine unless necessary

That leads to an important architectural distinction:

- **execution nodes**: internal workflow units used by LangGraph and backend logic
- **display phases**: higher-level milestones shown in the frontend and SSE contract


## 4. Two Possible Consolidation Strategies

### Option A - Recommended: Keep 11 Internal Execution Nodes, Expose 5 Display Phases

This means:

- LangGraph still runs 11 internal nodes
- backend event layer maps them to 5 larger phases
- frontend renders only 5 top-level pipeline cards
- each phase can show the current substep inside it

This is the best tradeoff for the current codebase.

#### Advantages

- minimal disruption to existing backend logic
- preserves branch parallelism
- preserves failure localization
- avoids rewriting node wrappers and merge logic
- easiest to implement incrementally
- best fit for demo/UI simplification

#### Disadvantages

- backend still internally "has 11 nodes"
- terminology becomes two-layered:
  - internal node
  - external phase


### Option B - Aggressive: Physically Merge the Graph into 4-5 Actual LangGraph Nodes

This means rewriting the workflow graph itself so the backend truly only has 4-5 nodes.

Example:

- one node handles `prepare_input + asr + segment`
- one node handles `lexical + prosody + disfluency + context`
- one node handles `merge_analysis`
- one node handles `reasoning + feedback`
- one node handles `serialize_result`

#### Advantages

- frontend and backend terminology fully align
- job progress naturally becomes 5 steps

#### Disadvantages

- larger code changes
- weaker error localization
- parallel branch semantics become hidden inside a big node
- future debugging becomes harder
- more regression risk for replay, SSE, and state snapshots


## 5. Recommendation

### Recommended final direction

Use **Option A** now:

- retain 11 execution nodes internally
- expose **5 display phases** externally

This gives the UI the simplified structure it needs without damaging backend maintainability.


## 6. Recommended 5-Phase Model

### Phase 1: `input`

Contains:

- `prepare_input`
- `asr`
- `segment`

User-facing meaning:

- input normalization
- transcript acquisition
- segment preparation

Recommended UI label:

- `Input`


### Phase 2: `analysis`

Contains:

- `lexical`
- `prosody`
- `disfluency`
- `context`

User-facing meaning:

- multi-dimensional speech analysis

Recommended UI label:

- `Analysis`


### Phase 3: `fusion`

Contains:

- `merge_analysis`

User-facing meaning:

- merge branch outputs into a coherent segment-level score structure

Recommended UI label:

- `Fusion`


### Phase 4: `coaching`

Contains:

- `reasoning`
- `feedback`

User-facing meaning:

- generate explanation, summary, dominant causes, and coaching suggestions

Recommended UI label:

- `Coaching`


### Phase 5: `export`

Contains:

- `serialize_result`

User-facing meaning:

- finalize and export the runtime result

Recommended UI label:

- `Export`


## 7. Why 5 Phases Is Better Than 4

A 4-phase model is possible:

- Input
- Analysis
- Coaching
- Export

But it hides `merge_analysis` too early.

For this project, `merge_analysis` is still a meaningful technical boundary because it separates:

- branch-level scoring
- final high-level reasoning

So 5 phases is the best balance:

- much simpler than 11
- still technically honest


## 8. Proposed Mapping Table

| Internal node | Display phase | Suggested substep label |
| --- | --- | --- |
| `prepare_input` | `input` | `Preprocess` |
| `asr` | `input` | `Transcribe` |
| `segment` | `input` | `Segment` |
| `lexical` | `analysis` | `Lexical` |
| `prosody` | `analysis` | `Prosody` |
| `disfluency` | `analysis` | `Disfluency` |
| `context` | `analysis` | `Context` |
| `merge_analysis` | `fusion` | `Merge` |
| `reasoning` | `coaching` | `Reasoning` |
| `feedback` | `coaching` | `Feedback` |
| `serialize_result` | `export` | `Serialize` |


## 9. Backend Impact Analysis

### 9.1 `graph_builder.py`

Current file:

- `services/agent/src/orchestration/graph_builder.py`

Current reality:

- progress events are emitted per internal node
- `node_names` is the exact 11-node sequence

Recommended change:

- keep the graph execution order as-is
- introduce a mapping such as:

```python
RAW_NODE_TO_PHASE = {
    "prepare_input": ("input", "Preprocess"),
    "asr": ("input", "Transcribe"),
    "segment": ("input", "Segment"),
    "lexical": ("analysis", "Lexical"),
    "prosody": ("analysis", "Prosody"),
    "disfluency": ("analysis", "Disfluency"),
    "context": ("analysis", "Context"),
    "merge_analysis": ("fusion", "Merge"),
    "reasoning": ("coaching", "Reasoning"),
    "feedback": ("coaching", "Feedback"),
    "serialize_result": ("export", "Serialize"),
}
```

Then when `_emit_progress()` is called, enrich each event payload with:

- `raw_node`
- `phase`
- `substep`
- `phase_index`
- `phase_total`

That way:

- backend remains correct internally
- frontend only needs 5 phase cards


### 9.2 `http_api.py`

Current file:

- `services/agent/src/app/usecases/http_api.py`

Current issue:

- `AnalysisJob.total_steps` is initialized to `11`
- `current_node` is a raw internal node name

Recommended change:

- introduce two layers in the job contract:
  - `current_node_raw`
  - `current_phase`
- or minimally:
  - keep `current_node` for compatibility
  - add `current_phase`
  - add `display_total_steps = 5`

Recommended fields:

- `current_phase: str | None`
- `current_substep: str | None`
- `display_completed_steps: int`
- `display_total_steps: int = 5`

Important note:

Do **not** remove raw node information immediately, because replay/debug still benefits from it.


### 9.3 Replay contract

Replay currently reconstructs events from saved JSON and the known node order.

If the UI moves to 5 phases, replay should:

- still preserve raw internal events if needed
- but generate phase-aware display data

Recommended model:

- raw event history stays 11-step compatible
- UI display layer groups events by phase


## 10. Frontend Impact Analysis

### 10.1 `types/analysis.ts`

Current file:

- `services/agent/frontend/src/types/analysis.ts`

Current issue:

- `NodeName` directly drives UI pipeline semantics
- `pipelineOrder` is 11 nodes

Recommended change:

- keep `NodeName` as raw backend node names
- add a new `PhaseName` type:

```ts
type PhaseName = "input" | "analysis" | "fusion" | "coaching" | "export";
```

- add:
  - `phaseOrder`
  - `phaseIcons`
  - `phaseAccentClasses`

This separates:

- raw backend identity
- display-level pipeline identity


### 10.2 `analysis-helpers.ts`

Current file:

- `services/agent/frontend/src/lib/analysis-helpers.ts`

This file is currently heavily 11-node oriented:

- `pipelineOrder`
- `nodeSnapshot`
- `buildNodeVisuals()`
- `buildNodeDetails()`
- replay event generation

Recommended change:

- introduce a phase aggregation layer
- convert node visuals into phase visuals
- within each phase card, show:
  - phase title
  - current substep
  - substep checklist or chips

For example:

- `Input`
  - Preprocess
  - Transcribe
  - Segment

- `Analysis`
  - Lexical
  - Prosody
  - Disfluency
  - Context


### 10.3 `NodeGrid` and `NodeSpotlight`

Current files:

- `services/agent/frontend/src/components/pipeline/NodeGrid.tsx`
- `services/agent/frontend/src/components/pipeline/NodeSpotlight.tsx`

These currently assume "one card per raw node".

Recommended change:

- replace `NodeGrid` with a `PhaseGrid`
- each phase card can contain:
  - phase label
  - status
  - active substep
  - small substep chips

Then the right-hand panel can show:

- selected phase summary
- selected substep detail

This reduces visual noise while keeping technical depth available.


### 10.4 Progress bar logic

Recommended approach:

- keep progress smooth using raw internal progress
- display top-level count using phase count

Example:

- overall progress bar: computed from raw 11-step completion ratio
- phase label: `3 / 5 phases`

This is better than converting progress to coarse 20% jumps.


## 11. Suggested UI Behavior After Consolidation

### Pipeline page

Replace 11 visible nodes with 5 visible phases:

1. Input
2. Analysis
3. Fusion
4. Coaching
5. Export

Each phase card should display:

- current status
- compact summary
- active substep
- completed substeps

Example:

```text
Analysis
Active substep: Prosody
Completed: Lexical
Pending: Disfluency, Context
```


### Timeline

Timeline can continue to show raw events if desired, because timeline is a lower-level debug surface.

That gives a good split:

- pipeline cards = high-level phases
- timeline = low-level raw events


### Debug page

Debug should remain raw.

This is important:

- `Pipeline` is for presentation clarity
- `Debug` is for implementation truth


## 12. Migration Strategy

### Phase 1 - Contract-level consolidation

Change only the event/display layer:

- add phase mapping in backend
- add phase fields to SSE payload
- keep internal graph unchanged
- keep raw node in payload

This already solves most UI problems.


### Phase 2 - Frontend display consolidation

- switch pipeline cards from node-level to phase-level
- keep timeline raw
- keep debug raw


### Phase 3 - Optional backend physical merge

Only if still necessary later:

- physically merge graph nodes
- simplify job step counts
- simplify replay generation

This should be a later optimization, not the first move.


## 13. Final Recommendation

### Recommended target

Use this external 5-phase model:

- `Input`
- `Analysis`
- `Fusion`
- `Coaching`
- `Export`

### Recommended implementation path

1. **Do not immediately collapse the LangGraph execution graph**
2. **Introduce a backend phase mapping layer**
3. **Render only 5 phases in the frontend**
4. **Keep raw nodes available in timeline and debug**

This gives the best outcome for:

- demo clarity
- UI simplicity
- backend safety
- future maintainability


## 14. Concrete Conclusion

If the project goal is a better presentation workflow, then the real problem is not:

- "the backend has 11 internal steps"

The real problem is:

- "the frontend is exposing internal execution granularity as if it were the primary user workflow"

So the best fix is:

- **merge at the presentation contract layer first**
- **not at the execution engine layer first**

That is the most reasonable and lowest-risk consolidation strategy for this codebase.
