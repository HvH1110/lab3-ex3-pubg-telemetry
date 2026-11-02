import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App';

const squadButton = (name: RegExp): HTMLElement => screen.getByRole('button', { name });
const status = (): string | null =>
  screen.getByRole('region', { name: 'Live Squad Radar' }).getAttribute('data-status');

beforeEach(() => {
  vi.useFakeTimers();
  // Serve the shipped JSON fixtures instead of a dev server.
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const id = String(input).match(/(\w+)\.json$/)?.[1] ?? '';
      return Promise.resolve(new Response(readFileSync(`public/api/telemetry/${id}.json`, 'utf8')));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the page heading and starts IDLE', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PVS Live Telemetry');
    expect(status()).toBe('IDLE');
  });

  it('marks the selected squad with aria-pressed', () => {
    render(<App />);
    fireEvent.click(squadButton(/The Expendables/));
    expect(squadButton(/The Expendables/).getAttribute('aria-pressed')).toBe('true');
    expect(squadButton(/Cerberus Esports/).getAttribute('aria-pressed')).toBe('false');
  });

  it('loads a squad over the stable link', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Satellite link'), { target: { value: '0' } });
    fireEvent.click(squadButton(/Cerberus Esports/));
    expect(status()).toBe('LOADING');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(status()).toBe('SUCCESS');
    expect(screen.getByRole('article', { name: 'Cerberus Esports' })).toBeDefined();
  });

  it('fails every sync during a blackout', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Satellite link'), { target: { value: '1' } });
    fireEvent.click(squadButton(/Genius Esports/));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(status()).toBe('ERROR');
  });

  it('uses no <div> and gives every button an explicit type', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('div div')).toHaveLength(0);
    for (const button of screen.getAllByRole('button')) expect(button.getAttribute('type')).toBe('button');
  });
});
