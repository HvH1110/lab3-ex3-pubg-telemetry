export type SquadId = 'ces' | 'te' | 'ge';

export interface Squad {
  readonly id: SquadId;
  readonly name: string;
  readonly tag: string;
}

/** PUBG Vietnam Series squads tracked by the radar. */
export const SQUADS: readonly Squad[] = [
  { id: 'ces', name: 'Cerberus Esports', tag: 'CES' },
  { id: 'te', name: 'The Expendables', tag: 'TE' },
  { id: 'ge', name: 'Genius Esports', tag: 'GE' },
];

export type PubgMap = 'Erangel' | 'Miramar' | 'Taego' | 'Sanhok' | 'Vikendi';

export const PUBG_MAPS: readonly PubgMap[] = ['Erangel', 'Miramar', 'Taego', 'Sanhok', 'Vikendi'];

/** One validated telemetry packet. Network data is `unknown` until `parseTelemetry` turns it into this. */
export interface SquadTelemetry {
  readonly id: SquadId;
  readonly name: string;
  readonly map: PubgMap;
  readonly phase: number;
  /** Players still alive, 0–4. */
  readonly alive: number;
  readonly kills: number;
  /** Winner Winner Chicken Dinner probability, 0–1. */
  readonly wwcdProbability: number;
  readonly status: string;
}

/** The widget's only state. Each variant carries exactly the data that is valid in it. */
export type TelemetryView =
  | { readonly status: 'IDLE' }
  | { readonly status: 'LOADING'; readonly squadId: SquadId }
  | { readonly status: 'SUCCESS'; readonly data: SquadTelemetry }
  | { readonly status: 'ERROR'; readonly squadId: SquadId; readonly error: string };

export type TelemetryStatus = TelemetryView['status'];

export type TelemetryEvent =
  | { readonly type: 'FETCH'; readonly squadId: SquadId }
  | { readonly type: 'RESOLVE'; readonly data: SquadTelemetry }
  | { readonly type: 'REJECT'; readonly squadId: SquadId; readonly error: string }
  | { readonly type: 'RESET' };

/** Loads one squad. Must reject with an `AbortError` once `signal` aborts. */
export type TelemetryFetcher = (squadId: SquadId, signal: AbortSignal) => Promise<SquadTelemetry>;

export function isSquadId(value: unknown): value is SquadId {
  return SQUADS.some((squad) => squad.id === value);
}

export function findSquad(id: SquadId): Squad {
  const squad = SQUADS.find((s) => s.id === id);
  if (squad === undefined) throw new Error(`Unknown squad ${id}`);
  return squad;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
