# SpeakSure++ Admin Console Refactor

## Goal

Refactor the frontend from a "top-level tabs stacked over page-level tabs" model into a more natural management-console layout:

- compact top bar
- persistent left sidebar for primary navigation
- main content area for page-specific secondary navigation and content

This is a better fit for SpeakSure++ because the product already behaves like a desktop review console rather than a single marketing-style app page.

## Why the current layout is not ideal

The current structure uses:

- top-level route tabs
- secondary tabs inside each page

That works functionally, but it creates two problems:

1. the main navigation layer and page subview layer feel visually too similar
2. the top region takes more vertical space than a desktop-oriented console should

For a tool with multiple modules and shareable deep-link state, a left-hand primary navigation is easier to scan and more consistent with admin and analysis platforms.

## Target information architecture

### Primary navigation in sidebar

The sidebar should own the four top-level routes:

- `Run`
- `Pipeline`
- `Results`
- `Debug`

Each item should:

- route to the existing page path
- preserve the remembered `?view=` subview
- feel like a stable workspace module, not a page-local toggle

### Compact top bar

The top bar should be narrow and persistent.

It should show:

- product identity
- current mode (`Live SSE` / `Replay`)
- current node
- runtime status / event count

The top bar should not try to act like a second navigation system.

### Main content area

The content area should remain route-driven.

Each page should continue to own its own secondary navigation:

- `Run`: `Overview / Setup / Session`
- `Pipeline`: `Overview / Nodes / Timeline / Spotlight`
- `Results`: `Overview / Feedback / Segments`
- `Debug`: `Overview / Metadata / State JSON / Event payload`

The existing URL-driven state model should be preserved.

## Layout target

```text
--------------------------------------------------------
| Top bar                                               |
--------------------------------------------------------
| Sidebar            | Page header + secondary tabs     |
| Sidebar            | Main content                     |
| Sidebar            | Main content                     |
--------------------------------------------------------
```

## State rules to preserve

Existing route and query-state behavior should remain valid:

- `/run?view=setup&mode=live&scenario=presentation`
- `/pipeline?view=timeline&node=feedback&frame=3`
- `/results?view=feedback&feedback=seg_001`
- `/debug?view=overview&panel=result-json`

The refactor should be primarily visual and structural, not a state-model reset.

## Implementation notes

- keep React Router page routes unchanged
- keep secondary-tab `?view=` state unchanged
- keep remembered subview behavior unchanged
- move primary nav out of the top area and into a dedicated sidebar component
- reduce top chrome height so the content area gets more vertical space
- avoid making the sidebar collapsible for now; desktop-first is acceptable

## Execution TODO

### Phase 1: Shell refactor

- [ ] replace `TopTabs` usage in `AppShell` with a persistent left sidebar
- [ ] introduce a compact top bar with session/runtime summary
- [ ] keep primary route links deep-link aware

### Phase 2: Navigation components

- [ ] add a new sidebar navigation component
- [ ] style the active route as a true primary navigation item
- [ ] keep route descriptions visible but compact

### Phase 3: Content fit

- [ ] ensure the main content area still scrolls correctly
- [ ] ensure page-level secondary tabs still look like subnavigation, not primary navigation
- [ ] tighten vertical spacing after shell refactor if needed

### Phase 4: Verification

- [ ] run `npm run build`
- [ ] confirm route URLs still open correct pages and remembered views
- [ ] confirm no layout clipping in main desktop workflow
