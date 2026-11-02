import { useId } from 'react';
import type { SquadTelemetry } from '../types';
import styles from './TelemetryCard.module.css';

const percent = new Intl.NumberFormat('en-US', { style: 'percent' });

const STAT_LABELS = ['Map', 'Phase', 'Alive', 'Kills', 'WWCD chance'] as const;

export function TelemetryCard({ data }: { readonly data: SquadTelemetry }) {
  const headingId = useId();
  const values: Record<(typeof STAT_LABELS)[number], string | number> = {
    Map: data.map,
    Phase: data.phase,
    Alive: `${data.alive} / 4`,
    Kills: data.kills,
    'WWCD chance': percent.format(data.wwcdProbability),
  };
  return (
    <article className={styles.card} aria-labelledby={headingId}>
      <h3 id={headingId}>{data.name}</h3>
      <p>{data.status}</p>
      <dl className={styles.stats}>
        {STAT_LABELS.map((label) => (
          <StatRow key={label} label={label} value={values[label]} />
        ))}
      </dl>
    </article>
  );
}

function StatRow({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/**
 * Blue-Zone skeleton: the same elements, classes and line boxes as TelemetryCard with placeholder bars instead
 * of text, so swapping LOADING for SUCCESS moves nothing (CLS 0.00). Hidden from assistive tech; the panel's
 * live region announces the sync instead.
 */
export function TelemetryCardSkeleton() {
  return (
    <article className={`${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <h3>{' '}</h3>
      <p>{' '}</p>
      <dl className={styles.stats}>
        {STAT_LABELS.map((label) => (
          <StatRow key={label} label={label} value={' '} />
        ))}
      </dl>
    </article>
  );
}
