import type { Squad, SquadId } from '../types';

export interface SquadSelectorProps {
  readonly squads: readonly Squad[];
  readonly selectedId: SquadId | null;
  readonly onSelect: (id: SquadId) => void;
}

export function SquadSelector({ squads, selectedId, onSelect }: SquadSelectorProps) {
  return (
    <fieldset>
      <legend>Squad</legend>
      <ul>
        {squads.map((squad) => (
          <li key={squad.id}>
            <button type="button" aria-pressed={squad.id === selectedId} onClick={() => onSelect(squad.id)}>
              <strong>{squad.tag}</strong> <small>{squad.name}</small>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
