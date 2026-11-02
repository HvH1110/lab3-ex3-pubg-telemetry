# Lab 03 · Exercise 3: KRAFTON PUBG Vietnam Series (PVS) Live Telemetry

A fault-tolerant live radar for Vietnamese PUBG pro squads: **Cerberus Esports (CES)**, **The Expendables (TE)** and
**Genius Esports (GE)**. Lab 2's `ViewState<T>` is upgraded to React 19: a strict 4-state machine
(`IDLE`, `LOADING`, `SUCCESS`, `ERROR`) runs inside `useEffect` with an `AbortController`. Rapid squad switching
cancels stale requests, a 220px Blue-Zone skeleton keeps the layout still, and satellite packet loss ends in an
accessible alert with **Reconnect Satellite (Retry)**. No `window.alert()`.

> Match data is simulated for the lab (the squad numbers come from the lab brief).

- Rules: [project-rules.md](project-rules.md)
- Work breakdown: [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md)

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + checkpoint tests (Vitest, jsdom, Testing Library, fake timers)
npm run typecheck  # tsc --noEmit (strict)
npm run build      # typecheck + production bundle
```

Use **Satellite link** to switch between *Stable link* (0% loss), *Erangel satellite* (35% loss, default) and
*Blackout* (100% loss).

## The state machine

```ts
type TelemetryView =
  | { status: 'IDLE' }
  | { status: 'LOADING'; squadId: SquadId }
  | { status: 'SUCCESS'; data: SquadTelemetry }
  | { status: 'ERROR'; squadId: SquadId; error: string };
```

```
                FETCH(squad)                RESOLVE(data) ✓ data.id === loading squad
   IDLE ───────────────────► LOADING(squad) ─────────────────────────────────► SUCCESS
                               │   ▲  ▲                                          │
                               │   │  └──── FETCH(other squad): switch ──────────┘
                               │   └─────── FETCH(same squad): Retry ────────┐
                               │ REJECT ✓ same squad                         │
                               └───────────────────────────────────► ERROR ──┘
```

`telemetryReducer` is pure, and events that don't apply return the **same object**, so React skips the render.
`IDLE` is derived from "no squad selected" instead of being synced into state.

## The effect

```ts
useEffect(() => {
  if (squadId === null) return undefined;
  const controller = new AbortController();
  dispatch({ type: 'FETCH', squadId });
  fetchTelemetry(squadId, controller.signal).then(
    (data) => { if (!controller.signal.aborted) dispatch({ type: 'RESOLVE', data }); },
    (error) => {
      if (controller.signal.aborted || isAbortError(error)) return;   // never flash an error on abort
      dispatch({ type: 'REJECT', squadId, error: describeTelemetryError(error) });
    },
  );
  return () => controller.abort();                                     // switch, retry, unmount, StrictMode
}, [squadId, retryTick, fetchTelemetry]);
```

| Hazard | Defence |
|--------|---------|
| User clicks CES → TE → GE while CES is in flight | Cleanup aborts CES and TE; the Network tab shows them as **(canceled)** |
| Abort rejects with `AbortError` | Ignored, so no false "link lost" banner while switching |
| Backend ignores the signal and answers late | `signal.aborted` check, then the reducer drops any `RESOLVE`/`REJECT` whose squad is not the one `LOADING` |
| Component unmounts mid-request | Same cleanup; the service's sync timer is cleared on abort (no leaked timers) |
| StrictMode double effect on mount | First run is aborted, second wins (tested with a squad preselected) |
| Malformed or wrong-squad payload | `parseTelemetry` validates `unknown` and turns it into `ERROR`, never a crash |
| Raw errors (`net::ERR_…`, `HTTP 503`) | `describeTelemetryError` maps them to player-friendly sentences |
| Stale closure / missing deps | Honest deps `[squadId, retryTick, fetchTelemetry]`; the fetcher is memoised per link quality |

## The service

`createTelemetryFetcher()` GETs `public/api/telemetry/<squad>.json` with the signal (a real request, so DevTools
throttling and cancellation are visible), validates it, waits a 900 ms abortable "satellite sync" so the skeleton is
visible on a fast network, then drops the packet when `random() < lossRate` (35% by default). `random`, `fetchImpl`,
`lossRate` and the delay are injectable for tests.

## Feedback UI

- **IDLE**: "Select a squad to sync the KRAFTON radar."
- **LOADING**: an `aria-hidden` Blue-Zone skeleton built from the same `h3`/`p`/`dl` elements and line boxes as the
  real card, pulsing (off under `prefers-reduced-motion`). The panel gets `aria-busy="true"`.
- **SUCCESS**: `<article>` with the squad name, status and a `<dl>`: map, phase, alive, kills, WWCD chance.
- **ERROR**: `<section role="alert">` with "Blue-Zone link lost", a human-readable reason and
  **Reconnect Satellite (Retry)**. Retry keeps keyboard focus in the panel (the heading takes it).
- One persistent visually-hidden `role="status"` region announces "Syncing … / … synced: 4 alive, 18 kills."
- Every state reserves 220px. Measured in Chrome, the panel is **305px in all four states** at 375px and 1280px.

## Checkpoint 3 audit checklist

1. `npm run dev`, open Chrome DevTools.
2. **Network → Slow 3G**, filter `telemetry`. Pick *Stable link*, then click **CES → TE → GE** quickly:
   `ces.json` and `te.json` show **(canceled)**, `ge.json` finishes, and the card shows Genius Esports with no alert.
3. **Performance** (or the Web Vitals overlay): record a squad switch; Cumulative Layout Shift is **0.00**.
4. **Elements** during loading: `section[data-status="LOADING"][aria-busy="true"]` contains
   `article[aria-hidden="true"]`. **Rendering → prefers-reduced-motion: reduce** stops the pulse.
5. Pick *Blackout*: `section[role="alert"]` appears with **Reconnect Satellite (Retry)**; switch to *Stable link* and
   retry to recover.
6. `grep -n "controller.abort" src/hooks/useSquadTelemetry.ts` shows the cleanup; `grep -rn "alert(" src` → none.

## Structure

| File | Responsibility |
|------|----------------|
| `src/types.ts` | Contracts: `SquadId`, `SQUADS`, `SquadTelemetry`, `TelemetryView`, `TelemetryEvent`, `TelemetryFetcher` |
| `src/state/telemetry-reducer.ts` | Pure 4-state `telemetryReducer` with the squad guard |
| `src/services/telemetry-service.ts` | Abortable fetcher, `abortableDelay`, `parseTelemetry`, packet loss, `describeTelemetryError` |
| `src/hooks/useSquadTelemetry.ts` | `useEffect` + `AbortController` + retry tick |
| `src/components/PubgMatchTelemetry.tsx` | Panel, live region, exhaustive per-state body, retry focus |
| `src/components/TelemetryCard.tsx` | Squad card and its skeleton twin |
| `src/components/SquadSelector.tsx` | `aria-pressed` squad buttons in a `fieldset` |
| `public/api/telemetry/*.json` | CES, TE, GE packets |

## Commit history

Each task in `TASK_DECOMPOSITION.md` is one Conventional Commit, including the two mandatory ones:
`feat(ex3): implement PUBG VN 4-state telemetry & AbortController` and `feat(ex3): add skeleton UI & retry alert`.
