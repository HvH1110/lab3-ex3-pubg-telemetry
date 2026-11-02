import { useId } from 'react';
import { useSquadTelemetry } from '../hooks/useSquadTelemetry';
import { createTelemetryFetcher } from '../services/telemetry-service';
import { assertNever, findSquad, type SquadId, type TelemetryFetcher, type TelemetryView } from '../types';
import { TelemetryCard } from './TelemetryCard';

/** Module-level so its identity is stable and the effect does not re-run on every render. */
const DEFAULT_FETCHER = createTelemetryFetcher();

export interface PubgMatchTelemetryProps {
  readonly squadId?: SquadId | null;
  readonly fetchTelemetry?: TelemetryFetcher;
}

/** Text for the persistent live region; ERROR is announced by its own role="alert" instead. */
function announcement(view: TelemetryView): string {
  switch (view.status) {
    case 'IDLE':
    case 'ERROR':
      return '';
    case 'LOADING':
      return `Syncing KRAFTON radar for ${findSquad(view.squadId).name}…`;
    case 'SUCCESS':
      return `${view.data.name} synced: ${view.data.alive} alive, ${view.data.kills} kills.`;
    default:
      return assertNever(view);
  }
}

function TelemetryBody({ view }: { readonly view: TelemetryView }) {
  switch (view.status) {
    case 'IDLE':
      return <p>Select a squad to sync the KRAFTON radar.</p>;
    case 'LOADING':
      return <p>Syncing KRAFTON radar…</p>;
    case 'SUCCESS':
      return <TelemetryCard data={view.data} />;
    case 'ERROR':
      return <p role="alert">Blue-Zone link lost: {view.error}</p>;
    default:
      return assertNever(view);
  }
}

export function PubgMatchTelemetry({ squadId = null, fetchTelemetry = DEFAULT_FETCHER }: PubgMatchTelemetryProps) {
  const headingId = useId();
  const { view } = useSquadTelemetry(squadId, fetchTelemetry);

  return (
    <section aria-labelledby={headingId} aria-busy={view.status === 'LOADING'} data-status={view.status}>
      <h2 id={headingId}>Live Squad Radar</h2>
      <p role="status" aria-live="polite">
        {announcement(view)}
      </p>
      <TelemetryBody view={view} />
    </section>
  );
}
