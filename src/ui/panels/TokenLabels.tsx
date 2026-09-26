import { useEffect, useRef } from 'react';
import type { GameState, PlayerId } from '../../engine/types';

/**
 * Prénoms des joueurs, rendus en DOM au-dessus du canvas.
 *
 * Le positionnement est fait par la scène 3D, qui projette chaque image la
 * position réelle du pion (cf. `Tokens.tsx`). Le texte reste donc parfaitement
 * net, quel que soit l'angle — une étiquette peinte en texture deviendrait
 * illisible de biais.
 */
export const TokenLabels = ({
  state,
  register,
}: {
  state: GameState;
  register: (map: Map<PlayerId, HTMLElement | null>) => void;
}) => {
  const map = useRef(new Map<PlayerId, HTMLElement | null>());

  useEffect(() => {
    register(map.current);
  }, [register, state.order]);

  return (
    <div className="tokenlabels" aria-hidden="true">
      {state.order.map((id) => {
        const p = state.players[id];
        return (
          <span
            key={id}
            ref={(el) => {
              map.current.set(id, el);
            }}
            className="tokenlabel"
            style={{ ['--tl' as string]: p.color }}
          >
            {p.name}
          </span>
        );
      })}
    </div>
  );
};
