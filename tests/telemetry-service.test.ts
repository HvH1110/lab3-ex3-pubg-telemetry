import { readFileSync } from 'node:fs';
import {
  TelemetryError,
  abortableDelay,
  createTelemetryFetcher,
  describeTelemetryError,
  isAbortError,
  parseTelemetry,
} from '../src/services/telemetry-service';
import { SQUADS } from '../src/types';

const fixture = (id: string): unknown => JSON.parse(readFileSync(`public/api/telemetry/${id}.json`, 'utf8'));
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Settles a promise into a plain record so pending/resolved/rejected can be asserted under fake timers. */
function track<T>(promise: Promise<T>): { state: 'pending' | 'resolved' | 'rejected'; value?: T; error?: unknown } {
  const result: { state: 'pending' | 'resolved' | 'rejected'; value?: T; error?: unknown } = { state: 'pending' };
  promise.then(
    (value) => Object.assign(result, { state: 'resolved', value }),
    (error: unknown) => Object.assign(result, { state: 'rejected', error }),
  );
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseTelemetry', () => {
  it.each(SQUADS.map((s) => s.id))('accepts the shipped %s.json fixture', (id) => {
    expect(parseTelemetry(fixture(id), id).id).toBe(id);
  });

  it('rejects a payload for a different squad', () => {
    expect(() => parseTelemetry(fixture('te'), 'ces')).toThrow(TelemetryError);
  });

  it.each([
    ['null', null],
    ['string', 'te'],
    ['5 alive', { ...(fixture('te') as object), alive: 5 }],
    ['negative kills', { ...(fixture('te') as object), kills: -1 }],
    ['probability > 1', { ...(fixture('te') as object), wwcdProbability: 1.2 }],
    ['unknown map', { ...(fixture('te') as object), map: 'Atlantis' }],
    ['missing status', { ...(fixture('te') as object), status: undefined }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseTelemetry(payload, 'te')).toThrow(expect.objectContaining({ kind: 'MALFORMED' }));
  });
});

describe('abortableDelay', () => {
  it('resolves after the delay', async () => {
    const result = track(abortableDelay(500, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(499);
    expect(result.state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(result.state).toBe('resolved');
  });

  it('rejects with an AbortError and clears its timer on abort', async () => {
    const controller = new AbortController();
    const result = track(abortableDelay(500, controller.signal));
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.state).toBe('rejected');
    expect(isAbortError(result.error)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects immediately for an already-aborted signal', async () => {
    const result = track(abortableDelay(500, AbortSignal.abort()));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.state).toBe('rejected');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('createTelemetryFetcher', () => {
  const make = (options: Parameters<typeof createTelemetryFetcher>[0] = {}) => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(jsonResponse(fixture(String(input).match(/(\w+)\.json$/)?.[1] ?? ''))),
    );
    return { fetchImpl, fetcher: createTelemetryFetcher({ fetchImpl, baseUrl: '/', syncDelayMs: 900, ...options }) };
  };

  it('requests api/telemetry/<squad>.json with the abort signal', async () => {
    const { fetchImpl, fetcher } = make({ random: () => 0.99 });
    const controller = new AbortController();
    const result = track(fetcher('ces', controller.signal));
    await vi.advanceTimersByTimeAsync(900);
    expect(fetchImpl).toHaveBeenCalledWith('/api/telemetry/ces.json', expect.objectContaining({ signal: controller.signal }));
    expect(result.state).toBe('resolved');
    expect(result.value?.name).toBe('Cerberus Esports');
  });

  it('waits for the satellite sync before resolving', async () => {
    const { fetcher } = make({ random: () => 0.99 });
    const result = track(fetcher('te', new AbortController().signal));
    await vi.advanceTimersByTimeAsync(899);
    expect(result.state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(result.state).toBe('resolved');
  });

  it('drops the packet when random() < lossRate (35% by default)', async () => {
    const { fetcher } = make({ random: () => 0.34 });
    const result = track(fetcher('te', new AbortController().signal));
    await vi.advanceTimersByTimeAsync(900);
    expect(result.error).toMatchObject({ kind: 'PACKET_LOSS' });
  });

  it('keeps the packet when random() >= lossRate', async () => {
    const { fetcher } = make({ random: () => 0.35 });
    const result = track(fetcher('te', new AbortController().signal));
    await vi.advanceTimersByTimeAsync(900);
    expect(result.state).toBe('resolved');
  });

  it('turns an HTTP error status into an HTTP TelemetryError', async () => {
    const fetcher = createTelemetryFetcher({ fetchImpl: () => Promise.resolve(jsonResponse({}, 503)), baseUrl: '/' });
    const result = track(fetcher('te', new AbortController().signal));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.error).toMatchObject({ kind: 'HTTP' });
  });

  it('turns a non-JSON body into a MALFORMED TelemetryError', async () => {
    const fetcher = createTelemetryFetcher({ fetchImpl: () => Promise.resolve(new Response('<html>')), baseUrl: '/' });
    const result = track(fetcher('te', new AbortController().signal));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.error).toMatchObject({ kind: 'MALFORMED' });
  });

  it('rejects with AbortError and leaves no timer when aborted during the sync', async () => {
    const { fetcher } = make({ random: () => 0.99 });
    const controller = new AbortController();
    const result = track(fetcher('ge', controller.signal));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(isAbortError(result.error)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('describeTelemetryError', () => {
  it('maps every failure to a player-friendly sentence', () => {
    expect(describeTelemetryError(new TelemetryError('PACKET_LOSS', 'x'))).toMatch(/^Satellite packet timeout/);
    expect(describeTelemetryError(new TelemetryError('HTTP', 'HTTP 503'))).not.toContain('503');
    expect(describeTelemetryError(new TelemetryError('MALFORMED', 'x'))).toMatch(/corrupted packet/);
    expect(describeTelemetryError(new TypeError('Failed to fetch'))).toMatch(/^No connection/);
  });

  it('never leaks the raw error message', () => {
    expect(describeTelemetryError(new Error('net::ERR_INTERNET_DISCONNECTED'))).not.toContain('net::');
  });
});

describe('isAbortError', () => {
  it('recognises DOMException and plain AbortErrors only', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new TelemetryError('HTTP', 'x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
