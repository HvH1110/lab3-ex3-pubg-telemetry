# Project Rules — Lab 03 / Exercise 3: KRAFTON PUBG Vietnam Series (PVS) Live Telemetry

These rules are binding for every human or AI contribution to this repository.
A change that violates any rule below must not be committed. Lab 02 rules (`ViewState<T>` instead of boolean soup,
race-safe requests, human-readable errors, zero div-soup, XSS prevention) still apply in React 19 terms.

## 1. Workflow (Anti-Monolithic Vibe Coding)

1. **Functional slicing**: work only on tasks listed in `TASK_DECOMPOSITION.md`.
2. **Contract first**: types are written *before* the code that uses them.
3. **Atomic generation**: one sub-task per prompt and one sub-task per commit. Never paste the whole exercise into an AI tool.
4. **Independent verification**: every task is verified (unit test, `npm run typecheck`, DevTools Network/Performance, `git diff`) before it is committed.
5. Tick the matching checkbox in `TASK_DECOMPOSITION.md` in the same commit that completes the task.

## 2. Git

- Conventional Commits: `type(scope): imperative summary`. Types: `feat`, `fix`, `style`, `test`, `docs`, `chore`, `refactor`.
- Mandatory commit messages (exact text):
  - `feat(ex3): implement PUBG VN 4-state telemetry & AbortController`
  - `feat(ex3): add skeleton UI & retry alert`
- `npm test` and `npm run typecheck` must pass before every commit.

## 3. Stack

- React 19 + Vite + TypeScript `strict`; no `any` (use `unknown` + typeguards).
- `createRoot` from `react-dom/client` inside `<StrictMode>`. Named imports only.
- **BANNED:** class components, `ReactDOM.render`, `defaultProps`, `import * as React`, `keyCode`, `var`.

## 4. Finite State Machine

- The widget's state is **only** `TelemetryView`:
  `IDLE | LOADING(squadId) | SUCCESS(data) | ERROR(squadId, message)`.
- **BANNED:** parallel booleans (`isLoading`, `hasError`, `data`). They allow "loading and failed" at once.
- State changes only through the pure `telemetryReducer`. A `RESOLVE` / `REJECT` for a squad other than the one
  currently `LOADING` is ignored and returns the same state object.
- Rendering switches over `status` exhaustively (`assertNever`).

## 5. Effects & Race Conditions

- Every fetch runs inside `useEffect` with a **new `AbortController`**, and the effect **returns
  `() => controller.abort()`**. Switching squads, retrying or unmounting cancels the request in flight.
- An `AbortError` is never shown to the user: aborted requests return silently.
- Dependencies are honest: `[squadId, retryTick, fetchTelemetry]`. No `[]` with stale closures.
- Every timer the service creates is cleared when its signal aborts.
- Network data is `unknown` until `parseTelemetry` validates it. A malformed payload becomes `ERROR`, never a crash.

## 6. Feedback UI

- `LOADING` renders a pulsing Blue-Zone skeleton (min-height 220px) that mirrors the final card, marked `aria-hidden`,
  inside a panel with `aria-busy="true"`. The pulse stops under `prefers-reduced-motion`. Zero layout shift (CLS 0.00).
- `ERROR` renders a human-readable message in `<section role="alert">` with a
  **Reconnect Satellite (Retry)** button. **BANNED:** `window.alert()`, raw stack traces or `Error.message` from the network layer.
- One persistent `role="status"` live region announces loading and loaded squads.

## 7. Semantics, Security, Styling

- **BANNED:** `<div>` / `<span>` as structural containers. Use `<section>`, `<article>`, `<fieldset>`, `<dl>`, `<ul>`.
- Every button has `type="button"`; squad buttons expose `aria-pressed`. Every `<select>` has a `<label htmlFor>` from `useId()`.
- **BANNED:** `dangerouslySetInnerHTML`, `innerHTML`, `eval`.
- CSS Modules + custom properties, light and dark. No horizontal scroll from 375px to 1440px.
