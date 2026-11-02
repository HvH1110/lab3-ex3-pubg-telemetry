import { PUBG_MAPS, type PubgMap, type SquadId, type SquadTelemetry, type TelemetryFetcher } from '../types';

export type TelemetryErrorKind = 'PACKET_LOSS' | 'HTTP' | 'MALFORMED';

/** A failure the service understands. Anything else (e.g. a `TypeError` from `fetch`) is treated as offline. */
export class TelemetryError extends Error {
  override readonly name = 'TelemetryError';

  constructor(
    readonly kind: TelemetryErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export const DEFAULT_LOSS_RATE = 0.35;
export const DEFAULT_SYNC_DELAY_MS = 900;

export interface TelemetryServiceOptions {
  /** Probability (0–1) that a packet is lost during the satellite sync. */
  readonly lossRate?: number;
  /** Simulated satellite sync time after the HTTP response, so the skeleton is visible without throttling. */
  readonly syncDelayMs?: number;
  readonly random?: () => number;
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

/** The signal's own reason (a DOMException named AbortError by default), so callers can recognise it. */
function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

/** setTimeout that rejects, and clears its timer, as soon as the signal aborts. */
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = (): void => {
      window.clearTimeout(timerId);
      reject(abortReason(signal));
    };
    const timerId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const isCount = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

const isPubgMap = (value: unknown): value is PubgMap => PUBG_MAPS.some((map) => map === value);

/** Validates an untrusted payload. The id must match the squad that was requested. */
export function parseTelemetry(payload: unknown, expectedId: SquadId): SquadTelemetry {
  if (typeof payload !== 'object' || payload === null) throw new TelemetryError('MALFORMED', 'Payload is not an object');
  const p = payload as Record<string, unknown>;
  const valid =
    p['id'] === expectedId &&
    typeof p['name'] === 'string' &&
    isPubgMap(p['map']) &&
    isCount(p['phase'], 9) &&
    isCount(p['alive'], 4) &&
    isCount(p['kills']) &&
    typeof p['wwcdProbability'] === 'number' &&
    p['wwcdProbability'] >= 0 &&
    p['wwcdProbability'] <= 1 &&
    typeof p['status'] === 'string';
  if (!valid) throw new TelemetryError('MALFORMED', `Invalid telemetry for ${expectedId}`);
  return {
    id: expectedId,
    name: p['name'] as string,
    map: p['map'] as PubgMap,
    phase: p['phase'] as number,
    alive: p['alive'] as number,
    kills: p['kills'] as number,
    wwcdProbability: p['wwcdProbability'] as number,
    status: p['status'] as string,
  };
}

/**
 * Builds a fetcher that GETs `api/telemetry/<squad>.json` (a real request, visible in the Network tab and
 * cancelled there on abort), validates it, waits for the simulated satellite sync, then drops the packet
 * with probability `lossRate`. Every await is tied to the same signal.
 */
export function createTelemetryFetcher({
  lossRate = DEFAULT_LOSS_RATE,
  syncDelayMs = DEFAULT_SYNC_DELAY_MS,
  random = Math.random,
  fetchImpl = (input, init) => fetch(input, init),
  baseUrl = import.meta.env.BASE_URL,
}: TelemetryServiceOptions = {}): TelemetryFetcher {
  return async (squadId, signal) => {
    const response = await fetchImpl(`${baseUrl}api/telemetry/${squadId}.json`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new TelemetryError('HTTP', `HTTP ${response.status}`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TelemetryError('MALFORMED', 'Body is not JSON');
    }
    const telemetry = parseTelemetry(payload, squadId);
    await abortableDelay(syncDelayMs, signal);
    if (random() < lossRate) throw new TelemetryError('PACKET_LOSS', `Packet lost for ${squadId}`);
    return telemetry;
  };
}

/** Maps any failure to a message for players. Raw `Error.message` and stack traces never reach the UI. */
export function describeTelemetryError(error: unknown): string {
  if (error instanceof TelemetryError) {
    switch (error.kind) {
      case 'PACKET_LOSS':
        return 'Satellite packet timeout: the radar lost contact with the squad.';
      case 'HTTP':
        return 'The telemetry server is not responding right now.';
      case 'MALFORMED':
        return 'The radar received a corrupted packet.';
    }
  }
  return 'No connection to the telemetry server. Check your network.';
}
