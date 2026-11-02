import type { Squad, SquadId } from '../types';
import styles from './SquadSelector.module.css';

export interface SquadSelectorProps {
  readonly squads: readonly Squad[];
  readonly selectedId: SquadId | null;
  readonly onSelect: (id: SquadId) => void;
}

export function SquadSelector({ squads, selectedId, onSelect }: SquadSelectorProps) {
  return (
    <fieldset className={styles.selector}>
      <legend>Squad</legend>
      <ul className={styles.squads}>
        {squads.map((squad) => (
          <li key={squad.id}>
            <button
              className={styles.squad}
              type="button"
              aria-pressed={squad.id === selectedId}
              onClick={() => onSelect(squad.id)}
            >
              <strong>{squad.tag}</strong> <small>{squad.name}</small>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
