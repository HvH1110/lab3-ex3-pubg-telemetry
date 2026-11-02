import { useId } from 'react';
import type { SquadTelemetry } from '../types';

const percent = new Intl.NumberFormat('en-US', { style: 'percent' });

export function TelemetryCard({ data }: { readonly data: SquadTelemetry }) {
  const headingId = useId();
  return (
    <article aria-labelledby={headingId}>
      <h3 id={headingId}>{data.name}</h3>
      <p>{data.status}</p>
      <dl>
        <dt>Map</dt>
        <dd>{data.map}</dd>
        <dt>Phase</dt>
        <dd>{data.phase}</dd>
        <dt>Alive</dt>
        <dd>{data.alive} / 4</dd>
        <dt>Kills</dt>
        <dd>{data.kills}</dd>
        <dt>WWCD chance</dt>
        <dd>{percent.format(data.wwcdProbability)}</dd>
      </dl>
    </article>
  );
}
