import { readFileSync } from 'node:fs';
import { parseTelemetry } from '../src/services/telemetry-service';
import type { SquadId, SquadTelemetry, TelemetryFetcher } from '../src/types';

/** The shipped public/api/telemetry fixtures, parsed through the real validator. */
export const TELEMETRY: Readonly<Record<SquadId, SquadTelemetry>> = {
  ces: parseTelemetry(JSON.parse(readFileSync('public/api/telemetry/ces.json', 'utf8')), 'ces'),
  te: parseTelemetry(JSON.parse(readFileSync('public/api/telemetry/te.json', 'utf8')), 'te'),
  ge: parseTelemetry(JSON.parse(readFileSync('public/api/telemetry/ge.json', 'utf8')), 'ge'),
};

export interface FakeCall {
  readonly squadId: SquadId;
  readonly signal: AbortSignal;
  readonly resolve: (data: SquadTelemetry) => void;
  readonly reject: (error: unknown) => void;
}

/**
 * A fetcher whose calls are settled by the test. `cooperative: false` ignores the abort signal, simulating a
 * backend that answers late anyway.
 */
export function createFakeFetcher({ cooperative = true } = {}) {
  const calls: FakeCall[] = [];
  const fetcher = vi.fn<TelemetryFetcher>(
    (squadId, signal) =>
      new Promise((resolve, reject) => {
        calls.push({ squadId, signal, resolve, reject });
        if (cooperative) {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }
      }),
  );
  const last = (): FakeCall => {
    const call = calls.at(-1);
    if (call === undefined) throw new Error('fetcher was not called');
    return call;
  };
  return { fetcher, calls, last };
}
