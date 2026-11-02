import { useId, useRef } from 'react';
import { useSquadTelemetry } from '../hooks/useSquadTelemetry';
import { createTelemetryFetcher } from '../services/telemetry-service';
import { assertNever, findSquad, type SquadId, type TelemetryFetcher, type TelemetryView } from '../types';
import styles from './PubgMatchTelemetry.module.css';
import { TelemetryCard, TelemetryCardSkeleton } from './TelemetryCard';

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

function TelemetryBody({ view, onRetry }: { readonly view: TelemetryView; readonly onRetry: () => void }) {
  switch (view.status) {
    case 'IDLE':
      return <p className={styles.idle}>Select a squad to sync the KRAFTON radar.</p>;
    case 'LOADING':
      return <TelemetryCardSkeleton />;
    case 'SUCCESS':
      return <TelemetryCard data={view.data} />;
    case 'ERROR':
      return (
        <section className={styles.alert} role="alert">
          <h3>Blue-Zone link lost</h3>
          <p>{view.error}</p>
          <button className={styles.retry} type="button" onClick={onRetry}>
            Reconnect Satellite (Retry)
          </button>
        </section>
      );
    default:
      return assertNever(view);
  }
}

export function PubgMatchTelemetry({ squadId = null, fetchTelemetry = DEFAULT_FETCHER }: PubgMatchTelemetryProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { view, retry } = useSquadTelemetry(squadId, fetchTelemetry);

  const handleRetry = (): void => {
    retry();
    // The Retry button unmounts when LOADING starts; keep keyboard focus inside the panel.
    headingRef.current?.focus();
  };

  return (
    <section
      className={styles.panel}
      aria-labelledby={headingId}
      aria-busy={view.status === 'LOADING'}
      data-status={view.status}
    >
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        Live Squad Radar
      </h2>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement(view)}
      </p>
      <TelemetryBody view={view} onRetry={handleRetry} />
    </section>
  );
}
