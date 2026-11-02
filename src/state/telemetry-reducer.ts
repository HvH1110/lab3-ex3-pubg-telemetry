import { assertNever, type TelemetryEvent, type TelemetryView } from '../types';

export const IDLE_VIEW: TelemetryView = Object.freeze({ status: 'IDLE' });

/**
 * Pure transition function. Events that do not apply to the current state return the **same object**, so
 * React bails out of the render. RESOLVE / REJECT are accepted only for the squad that is currently LOADING:
 * a second guard (after AbortController) against a stale response landing on the wrong squad.
 */
export function telemetryReducer(state: TelemetryView, event: TelemetryEvent): TelemetryView {
  switch (event.type) {
    case 'FETCH':
      return state.status === 'LOADING' && state.squadId === event.squadId
        ? state
        : { status: 'LOADING', squadId: event.squadId };
    case 'RESOLVE':
      return state.status === 'LOADING' && state.squadId === event.data.id
        ? { status: 'SUCCESS', data: event.data }
        : state;
    case 'REJECT':
      return state.status === 'LOADING' && state.squadId === event.squadId
        ? { status: 'ERROR', squadId: event.squadId, error: event.error }
        : state;
    case 'RESET':
      return state.status === 'IDLE' ? state : IDLE_VIEW;
    default:
      return assertNever(event);
  }
}
