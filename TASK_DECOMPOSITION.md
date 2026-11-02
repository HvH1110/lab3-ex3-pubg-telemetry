# Work Breakdown Structure (WBS) — Exercise 3

Objective: build `<PubgMatchTelemetry />`, a fault-tolerant live radar for Vietnamese PUBG pro squads
(Cerberus Esports, The Expendables, Genius Esports). A strict 4-state machine (`IDLE`, `LOADING`, `SUCCESS`, `ERROR`)
drives a Blue-Zone skeleton, the squad stats, and an accessible error with **Reconnect Satellite (Retry)**.
Requests run in `useEffect` with an `AbortController`, so rapid squad switching cancels stale requests.
35% simulated satellite packet loss exercises the error path.

> RULE: Never prompt AI with more than one sub-task at a time. One task = one commit.

| # | Task | Verification | Commit |
|---|------|--------------|--------|
| 3.0 | Project rules & WBS | Review | `chore: add project rules and task decomposition` |
| 3.1 | React 19 + Vite + strict TS + Vitest/Testing Library; `createRoot` inside `StrictMode` | `npm test`, `npm run typecheck`, `npm run build` | `chore: scaffold react 19 vite typescript toolchain` |
| 3.2 | Contract: `SquadId`, `SquadTelemetry`, `TelemetryView`, `TelemetryEvent`, `TelemetryFetcher` + pure `telemetryReducer` | Unit tests (transition table) | `feat(types): define squad telemetry contracts and view state reducer` |
| 3.3 | Squad JSON in `public/api/telemetry`, abortable fetcher: validation, sync delay, simulated packet loss, human-readable errors | Unit tests (fake timers, abort) | `feat(data): add abortable telemetry service with simulated packet loss` |
| 3.4 | `useSquadTelemetry` (effect + `AbortController` cleanup + retry tick), squad selector, 4-state `PubgMatchTelemetry` | Unit tests (deferred promises, StrictMode) | `feat(ex3): implement PUBG VN 4-state telemetry & AbortController` |
| 3.5 | 220px Blue-Zone skeleton (`aria-busy`, zero CLS), `<section role="alert">` with Reconnect Satellite (Retry), CSS Modules, 375px | Unit tests + DevTools (Slow 3G, CLS) | `feat(ex3): add skeleton UI & retry alert` |
| 3.6 | README with Checkpoint 3 audit checklist | Manual review | `docs: add readme with state machine and abort audit checklist` |

## Checklist

- [x] Task 3.0: Write `project-rules.md` and `TASK_DECOMPOSITION.md`
- [x] Task 3.1: Scaffold React 19 toolchain
- [x] Task 3.2: Define contracts and reducer
- [x] Task 3.3: Implement abortable telemetry service
- [x] Task 3.4: Implement 4-state telemetry with AbortController
- [x] Task 3.5: Add skeleton UI and retry alert
- [ ] Task 3.6: Document Checkpoint 3 audit in README
