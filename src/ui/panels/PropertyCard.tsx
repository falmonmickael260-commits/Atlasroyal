import { GROUPS, RULES, tileAt } from '../../engine/board';
import { countOwnedIn, rentFor } from '../../engine/rules';
import { HUB_TILES, RESEAU_TILES } from '../../engine/board';
import { euro } from '../format';
import type { GameState } from '../../engine/types';

const LEVELS = ['Terrain nu', 'Maison', 'Villa', 'Grand Hôtel'] as const;

/** Fiche d'une case possédable : identité, barème, niveau actuel. */
export const PropertyCard = ({ state, tile }: { state: GameState; tile: number }) => {
  const t = tileAt(tile);
  const st = state.tiles[tile];

  if (t.kind === 'city') {
    const grp = GROUPS[t.group];
    return (
      <div>
        <div className="propcard__band" style={{ background: `linear-gradient(90deg, ${grp.glow}, ${grp.color})` }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="sheet__title">{t.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t.country} · groupe {grp.name}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', fontSize: 20 }}>
            {euro(t.price)}
          </div>
        </div>

        <div className="rents">
          {LEVELS.map((label, lvl) => (
            <div key={label} className={`rents__row ${st.level === lvl ? 'rents__row--on' : 'rents__row--off'}`}>
              <span>{label}</span>
              <span className="mono-num">{euro(t.rent[lvl])}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-muted)' }}>
          Construction : {euro(t.buildCost)} par niveau · groupe complet = loyer du terrain doublé
        </div>
      </div>
    );
  }

  if (t.kind === 'hub' || t.kind === 'reseau') {
    const list = t.kind === 'hub' ? HUB_TILES : RESEAU_TILES;
    const owned = st.owner ? countOwnedIn(state, st.owner, list) : 0;
    return (
      <div>
        <div className="propcard__band" style={{ background: t.kind === 'hub' ? '#60A5FA' : '#22C55E' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div className="sheet__title">{t.name}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', fontSize: 20 }}>
            {euro(t.price)}
          </div>
        </div>
        <div className="rents">
          {t.kind === 'hub'
            ? RULES.hubRent.map((r, i) => (
              <div key={i} className={`rents__row ${owned === i + 1 ? 'rents__row--on' : 'rents__row--off'}`}>
                <span>{i + 1} hub{i ? 's' : ''} possédé{i ? 's' : ''}</span>
                <span className="mono-num">{euro(r)}</span>
              </div>
            ))
            : RULES.reseauRent.map((m, i) => (
              <div key={i} className={`rents__row ${owned === i + 1 ? 'rents__row--on' : 'rents__row--off'}`}>
                <span>{i + 1} réseau{i ? 'x' : ''}</span>
                <span className="mono-num">{m} × somme des dés</span>
              </div>
            ))}
        </div>
        {st.owner && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-muted)' }}>
            Loyer actuel : {euro(rentFor(state, tile, 7))} (pour un lancer moyen)
          </div>
        )}
      </div>
    );
  }

  return <div className="sheet__title">{t.name}</div>;
};
