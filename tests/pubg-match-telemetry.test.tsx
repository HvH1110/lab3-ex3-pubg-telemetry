import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { PubgMatchTelemetry } from '../src/components/PubgMatchTelemetry';
import { TelemetryError } from '../src/services/telemetry-service';
import type { SquadId, TelemetryFetcher } from '../src/types';
import { TELEMETRY, createFakeFetcher, type FakeCall } from './telemetry-fixtures';

const panel = (): HTMLElement => screen.getByRole('region', { name: 'Live Squad Radar' });
const status = (): string | null => panel().getAttribute('data-status');
const liveText = (): string => within(panel()).getByRole('status').textContent ?? '';

const resolve = async (call: FakeCall, squadId: SquadId = call.squadId): Promise<void> => {
  await act(async () => call.resolve(TELEMETRY[squadId]));
};
const reject = async (call: FakeCall, error: unknown): Promise<void> => {
  await act(async () => call.reject(error));
};

const mount = (squadId: SquadId | null, fetcher: TelemetryFetcher) =>
  render(<PubgMatchTelemetry squadId={squadId} fetchTelemetry={fetcher} />);

describe('PubgMatchTelemetry: 4-state machine', () => {
  it('IDLE: asks for a squad and does not fetch', () => {
    const { fetcher } = createFakeFetcher();
    mount(null, fetcher);
    expect(status()).toBe('IDLE');
    expect(screen.getByText('Select a squad to sync the KRAFTON radar.')).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('LOADING: marks the panel busy and announces the sync', () => {
    const { fetcher } = createFakeFetcher();
    mount('te', fetcher);
    expect(status()).toBe('LOADING');
    expect(panel().getAttribute('aria-busy')).toBe('true');
    expect(liveText()).toBe('Syncing KRAFTON radar for The Expendables…');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('te');
  });

  it('SUCCESS: renders the squad card from the payload', async () => {
    const { fetcher, last } = createFakeFetcher();
    mount('te', fetcher);
    await resolve(last());
    expect(status()).toBe('SUCCESS');
    expect(panel().getAttribute('aria-busy')).toBe('false');
    const card = screen.getByRole('article', { name: 'The Expendables' });
    const pairs = [...card.querySelectorAll('dt')].map((dt) => `${dt.textContent}=${dt.nextElementSibling?.textContent}`);
    expect(pairs).toEqual(['Map=Miramar', 'Phase=7', 'Alive=4 / 4', 'Kills=18', 'WWCD chance=82%']);
    expect(within(card).getByText('Holding High Ground')).toBeDefined();
    expect(liveText()).toBe('The Expendables synced: 4 alive, 18 kills.');
  });

  it('ERROR: shows a human-readable alert, never the raw error', async () => {
    const { fetcher, last } = createFakeFetcher();
    mount('ge', fetcher);
    await reject(last(), new TelemetryError('PACKET_LOSS', 'Packet lost for ge'));
    expect(status()).toBe('ERROR');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Satellite packet timeout');
    expect(alert.textContent).not.toContain('Packet lost for ge');
    expect(liveText()).toBe('');
  });

  it('ERROR: an unknown failure becomes the offline message', async () => {
    const { fetcher, last } = createFakeFetcher();
    mount('ge', fetcher);
    await reject(last(), new TypeError('Failed to fetch'));
    expect(screen.getByRole('alert').textContent).toContain('No connection to the telemetry server');
  });

  it('shows exactly one of the four views at a time', async () => {
    const { fetcher, last } = createFakeFetcher();
    const { rerender } = mount(null, fetcher);
    const views = () => ({
      idle: screen.queryByText(/Select a squad/) !== null,
      card: screen.queryByRole('article') !== null,
      alert: screen.queryByRole('alert') !== null,
    });
    expect(views()).toEqual({ idle: true, card: false, alert: false });
    rerender(<PubgMatchTelemetry squadId="ces" fetchTelemetry={fetcher} />);
    expect(views()).toEqual({ idle: false, card: false, alert: false });
    await resolve(last());
    expect(views()).toEqual({ idle: false, card: true, alert: false });
  });
});

describe('PubgMatchTelemetry: skeleton & retry alert', () => {
  it('LOADING renders an aria-hidden skeleton that mirrors the card', async () => {
    const { fetcher, last } = createFakeFetcher();
    const { container } = mount('te', fetcher);
    const skeleton = container.querySelector('article[aria-hidden="true"]');
    if (skeleton === null) throw new Error('missing skeleton');
    const skeletonLabels = [...skeleton.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(skeleton.querySelectorAll('h3, p, dd')).toHaveLength(7);
    // Hidden from the accessibility tree, so no fake "article" or fake numbers are announced.
    expect(screen.queryByRole('article')).toBeNull();

    await resolve(last());
    const card = screen.getByRole('article', { name: 'The Expendables' });
    expect([...card.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(skeletonLabels);
    expect(card.className).toBe(skeleton.className.split(' ')[0]);
  });

  it('ERROR renders a <section role="alert"> with Reconnect Satellite (Retry)', async () => {
    const { fetcher, last } = createFakeFetcher();
    mount('te', fetcher);
    await reject(last(), new TelemetryError('PACKET_LOSS', 'x'));
    const alert = screen.getByRole('alert');
    expect(alert.tagName).toBe('SECTION');
    expect(within(alert).getByRole('heading', { level: 3 }).textContent).toBe('Blue-Zone link lost');
    const retry = within(alert).getByRole('button', { name: 'Reconnect Satellite (Retry)' });
    expect(retry.getAttribute('type')).toBe('button');
  });

  it('Retry re-runs the effect for the same squad and recovers', async () => {
    const { fetcher, calls, last } = createFakeFetcher();
    mount('te', fetcher);
    await reject(last(), new TelemetryError('PACKET_LOSS', 'x'));
    act(() => screen.getByRole('button', { name: 'Reconnect Satellite (Retry)' }).click());
    expect(calls.map((c) => c.squadId)).toEqual(['te', 'te']);
    expect(status()).toBe('LOADING');
    expect(screen.queryByRole('alert')).toBeNull();
    await resolve(last());
    expect(status()).toBe('SUCCESS');
  });

  it('keeps focus inside the panel when the Retry button disappears', async () => {
    const { fetcher, last } = createFakeFetcher();
    mount('te', fetcher);
    await reject(last(), new TelemetryError('HTTP', 'x'));
    const retry = screen.getByRole('button', { name: 'Reconnect Satellite (Retry)' });
    retry.focus();
    act(() => retry.click());
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  });

  it('keeps the live region mounted across states so screen readers hear every change', async () => {
    const { fetcher, last } = createFakeFetcher();
    mount('te', fetcher);
    const region = within(panel()).getByRole('status');
    await reject(last(), new TelemetryError('PACKET_LOSS', 'x'));
    expect(within(panel()).getByRole('status')).toBe(region);
  });
});

describe('PubgMatchTelemetry: AbortController & race conditions', () => {
  it('aborts the previous request when the squad changes (CES -> TE -> GE)', async () => {
    const { fetcher, calls, last } = createFakeFetcher();
    const { rerender } = mount('ces', fetcher);
    rerender(<PubgMatchTelemetry squadId="te" fetchTelemetry={fetcher} />);
    rerender(<PubgMatchTelemetry squadId="ge" fetchTelemetry={fetcher} />);
    expect(calls.map((c) => [c.squadId, c.signal.aborted])).toEqual([
      ['ces', true],
      ['te', true],
      ['ge', false],
    ]);
    await resolve(last());
    expect(screen.getByRole('article', { name: 'Genius Esports' })).toBeDefined();
  });

  it('never flashes an error banner for an intentional abort', async () => {
    const { fetcher } = createFakeFetcher();
    const { rerender } = mount('ces', fetcher);
    rerender(<PubgMatchTelemetry squadId="te" fetchTelemetry={fetcher} />);
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(status()).toBe('LOADING');
  });

  it('drops a late response from a backend that ignores the abort signal', async () => {
    const { fetcher, calls } = createFakeFetcher({ cooperative: false });
    const { rerender } = mount('ces', fetcher);
    rerender(<PubgMatchTelemetry squadId="te" fetchTelemetry={fetcher} />);
    const [stale, current] = calls as [FakeCall, FakeCall];
    await resolve(stale);
    expect(status()).toBe('LOADING');
    expect(screen.queryByRole('article', { name: 'Cerberus Esports' })).toBeNull();
    await resolve(current);
    expect(screen.getByRole('article', { name: 'The Expendables' })).toBeDefined();
  });

  it('drops a late failure from a backend that ignores the abort signal', async () => {
    const { fetcher, calls } = createFakeFetcher({ cooperative: false });
    const { rerender } = mount('ces', fetcher);
    rerender(<PubgMatchTelemetry squadId="te" fetchTelemetry={fetcher} />);
    await reject(calls[0] as FakeCall, new TelemetryError('HTTP', 'HTTP 500'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('aborts the request in flight on unmount', () => {
    const { fetcher, last } = createFakeFetcher();
    const { unmount } = mount('te', fetcher);
    unmount();
    expect(last().signal.aborted).toBe(true);
  });

  it('survives the StrictMode double effect: first run aborted, second run wins', async () => {
    const { fetcher, calls, last } = createFakeFetcher();
    render(
      <StrictMode>
        <PubgMatchTelemetry squadId="te" fetchTelemetry={fetcher} />
      </StrictMode>,
    );
    expect(calls.map((c) => c.signal.aborted)).toEqual([true, false]);
    await resolve(last());
    expect(status()).toBe('SUCCESS');
  });

  it('refetches when the fetcher changes (new link quality) and aborts the old one', () => {
    const first = createFakeFetcher();
    const second = createFakeFetcher();
    const { rerender } = mount('te', first.fetcher);
    rerender(<PubgMatchTelemetry squadId="te" fetchTelemetry={second.fetcher} />);
    expect(first.last().signal.aborted).toBe(true);
    expect(second.fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on an unrelated re-render', () => {
    const { fetcher } = createFakeFetcher();
    const { rerender } = mount('te', fetcher);
    rerender(<PubgMatchTelemetry squadId="te" fetchTelemetry={fetcher} />);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Checkpoint 3: source rules', () => {
  const hook = readFileSync('src/hooks/useSquadTelemetry.ts', 'utf8');

  it('returns controller.abort() from the effect cleanup', () => {
    expect(hook).toMatch(/return \(\) => controller\.abort\(\);/);
  });

  it('declares honest effect dependencies', () => {
    expect(hook).toContain('[squadId, retryTick, fetchTelemetry]');
  });

  it.each(['src/components/PubgMatchTelemetry.tsx', 'src/hooks/useSquadTelemetry.ts', 'src/App.tsx'])(
    '%s never calls window.alert or uses boolean loading flags',
    (file) => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\balert\(/);
      expect(source).not.toMatch(/isLoading|hasError|isError/);
    },
  );
});
