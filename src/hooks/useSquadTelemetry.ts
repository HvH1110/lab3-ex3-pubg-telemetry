import { useEffect, useReducer, useState } from 'react';
import { describeTelemetryError, isAbortError } from '../services/telemetry-service';
import { IDLE_VIEW, telemetryReducer } from '../state/telemetry-reducer';
import type { SquadId, TelemetryFetcher, TelemetryView } from '../types';

export interface SquadTelemetryResource {
  readonly view: TelemetryView;
  /** Re-runs the effect for the current squad (Reconnect Satellite). */
  readonly retry: () => void;
}

/**
 * Lab 2's ViewState<T> upgraded with an AbortController per effect run. Changing squad, retrying, swapping the
 * fetcher or unmounting runs the cleanup, which aborts the request in flight; StrictMode's dev double-invoke
 * does the same, so a leak shows up immediately.
 */
export function useSquadTelemetry(squadId: SquadId | null, fetchTelemetry: TelemetryFetcher): SquadTelemetryResource {
  const [view, dispatch] = useReducer(telemetryReducer, IDLE_VIEW);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (squadId === null) return undefined;
    const controller = new AbortController();
    dispatch({ type: 'FETCH', squadId });

    fetchTelemetry(squadId, controller.signal).then(
      (data) => {
        // A fetcher that ignores the signal can still resolve late; the reducer's squadId guard is the backstop.
        if (!controller.signal.aborted) dispatch({ type: 'RESOLVE', data });
      },
      (error: unknown) => {
        // Intentional aborts are not failures: never flash an error banner while switching squads.
        if (controller.signal.aborted || isAbortError(error)) return;
        dispatch({ type: 'REJECT', squadId, error: describeTelemetryError(error) });
      },
    );

    return () => controller.abort();
  }, [squadId, retryTick, fetchTelemetry]);

  return {
    // IDLE is derived from "no squad selected" instead of being synced into state by another effect.
    view: squadId === null ? IDLE_VIEW : view,
    retry: () => setRetryTick((tick) => tick + 1),
  };
}
