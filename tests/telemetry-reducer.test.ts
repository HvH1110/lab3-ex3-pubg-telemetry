import { IDLE_VIEW, telemetryReducer } from '../src/state/telemetry-reducer';
import { SQUADS, findSquad, isSquadId, type SquadTelemetry, type TelemetryView } from '../src/types';

const TE: SquadTelemetry = {
  id: 'te',
  name: 'The Expendables',
  map: 'Miramar',
  phase: 7,
  alive: 4,
  kills: 18,
  wwcdProbability: 0.82,
  status: 'Holding High Ground',
};

const loading = (squadId: 'ces' | 'te' | 'ge'): TelemetryView => ({ status: 'LOADING', squadId });

describe('telemetryReducer', () => {
  it('IDLE --FETCH--> LOADING', () => {
    expect(telemetryReducer(IDLE_VIEW, { type: 'FETCH', squadId: 'te' })).toEqual(loading('te'));
  });

  it('LOADING --RESOLVE (same squad)--> SUCCESS', () => {
    expect(telemetryReducer(loading('te'), { type: 'RESOLVE', data: TE })).toEqual({ status: 'SUCCESS', data: TE });
  });

  it('LOADING --REJECT (same squad)--> ERROR', () => {
    expect(telemetryReducer(loading('te'), { type: 'REJECT', squadId: 'te', error: 'lost' })).toEqual({
      status: 'ERROR',
      squadId: 'te',
      error: 'lost',
    });
  });

  it('drops a stale RESOLVE / REJECT for another squad (same object back)', () => {
    const state = loading('ces');
    expect(telemetryReducer(state, { type: 'RESOLVE', data: TE })).toBe(state);
    expect(telemetryReducer(state, { type: 'REJECT', squadId: 'te', error: 'x' })).toBe(state);
  });

  it('ignores RESOLVE / REJECT when nothing is loading', () => {
    const success: TelemetryView = { status: 'SUCCESS', data: TE };
    expect(telemetryReducer(IDLE_VIEW, { type: 'RESOLVE', data: TE })).toBe(IDLE_VIEW);
    expect(telemetryReducer(success, { type: 'REJECT', squadId: 'te', error: 'x' })).toBe(success);
  });

  it('SUCCESS / ERROR --FETCH--> LOADING (switch squad or retry)', () => {
    const error: TelemetryView = { status: 'ERROR', squadId: 'te', error: 'lost' };
    expect(telemetryReducer({ status: 'SUCCESS', data: TE }, { type: 'FETCH', squadId: 'ge' })).toEqual(loading('ge'));
    expect(telemetryReducer(error, { type: 'FETCH', squadId: 'te' })).toEqual(loading('te'));
  });

  it('returns the same object for a repeated FETCH of the loading squad', () => {
    const state = loading('te');
    expect(telemetryReducer(state, { type: 'FETCH', squadId: 'te' })).toBe(state);
  });

  it('RESET returns to IDLE, and is a no-op in IDLE', () => {
    expect(telemetryReducer(loading('te'), { type: 'RESET' })).toBe(IDLE_VIEW);
    expect(telemetryReducer(IDLE_VIEW, { type: 'RESET' })).toBe(IDLE_VIEW);
  });

  it('never produces a state outside the four variants', () => {
    const states: TelemetryView[] = [IDLE_VIEW, loading('te'), { status: 'SUCCESS', data: TE }];
    const events = [
      { type: 'FETCH', squadId: 'ge' },
      { type: 'RESOLVE', data: TE },
      { type: 'REJECT', squadId: 'te', error: 'e' },
      { type: 'RESET' },
    ] as const;
    for (const state of states) {
      for (const event of events) {
        expect(['IDLE', 'LOADING', 'SUCCESS', 'ERROR']).toContain(telemetryReducer(state, event).status);
      }
    }
  });
});

describe('squad contract', () => {
  it('tracks CES, TE and GE with unique ids', () => {
    expect(SQUADS.map((s) => s.tag)).toEqual(['CES', 'TE', 'GE']);
    expect(SQUADS.every((s) => isSquadId(s.id))).toBe(true);
  });

  it('rejects unknown squad ids', () => {
    expect(isSquadId('agg')).toBe(false);
    expect(isSquadId(undefined)).toBe(false);
  });

  it('finds squads by id', () => {
    expect(findSquad('te').name).toBe('The Expendables');
  });
});
