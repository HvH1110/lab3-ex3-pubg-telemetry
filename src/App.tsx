import { useId, useMemo, useState } from 'react';
import { PubgMatchTelemetry } from './components/PubgMatchTelemetry';
import { SquadSelector } from './components/SquadSelector';
import { DEFAULT_LOSS_RATE, createTelemetryFetcher } from './services/telemetry-service';
import { SQUADS, type SquadId } from './types';

const LINK_QUALITIES = [
  { lossRate: 0, label: 'Stable link (0% packet loss)' },
  { lossRate: DEFAULT_LOSS_RATE, label: 'Erangel satellite (35% packet loss)' },
  { lossRate: 1, label: 'Blackout (100% packet loss)' },
] as const;

export function App() {
  const linkId = useId();
  const [squadId, setSquadId] = useState<SquadId | null>(null);
  const [lossRate, setLossRate] = useState<number>(DEFAULT_LOSS_RATE);
  // One fetcher per link quality: a new identity re-runs the telemetry effect, an unchanged one does not.
  const fetchTelemetry = useMemo(() => createTelemetryFetcher({ lossRate }), [lossRate]);

  return (
    <>
      <header>
        <h1>PVS Live Telemetry</h1>
        <p>KRAFTON × PUBG Vietnam Series squad radar. Match data is simulated for the lab.</p>
      </header>
      <SquadSelector squads={SQUADS} selectedId={squadId} onSelect={setSquadId} />
      <p>
        <label htmlFor={linkId}>Satellite link</label>
        <select id={linkId} value={lossRate} onChange={(e) => setLossRate(Number(e.target.value))}>
          {LINK_QUALITIES.map((quality) => (
            <option key={quality.lossRate} value={quality.lossRate}>
              {quality.label}
            </option>
          ))}
        </select>
      </p>
      <PubgMatchTelemetry squadId={squadId} fetchTelemetry={fetchTelemetry} />
    </>
  );
}
