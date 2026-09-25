import { useState } from 'react';
import { tileAt } from '../../engine/board';
import { ownedBy } from '../../engine/rules';
import { Icon } from '../Icon';
import { euro } from '../format';
import { audio } from '../../audio/audio';
import type { Command, GameState, PlayerId, TileIndex } from '../../engine/types';

const Toggle = ({
  tiles, selected, onToggle, empty,
}: {
  tiles: TileIndex[]; selected: TileIndex[]; onToggle: (i: TileIndex) => void; empty: string;
}) => {
  if (tiles.length === 0) return <p style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{empty}</p>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tiles.map((i) => (
        <button
          key={i}
          className="pill-opt"
          aria-pressed={selected.includes(i)}
          onClick={() => { audio.click(); onToggle(i); }}
        >
          {tileAt(i).name}
        </button>
      ))}
    </div>
  );
};

/** Composition d'une offre : propriétés et liquidités dans les deux sens. */
export const TradePanel = ({
  state, me, onClose, send,
}: {
  state: GameState; me: PlayerId; onClose: () => void; send: (c: Command) => void;
}) => {
  const others = state.order.filter((id) => id !== me && !state.players[id].bankrupt);
  const [to, setTo] = useState<PlayerId>(others[0] ?? '');
  const [give, setGive] = useState<TileIndex[]>([]);
  const [get, setGet] = useState<TileIndex[]>([]);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);

  const incoming = state.trades.filter((t) => t.to === me);
  const outgoing = state.trades.filter((t) => t.from === me);

  // Une propriété construite n'est pas échangeable : on ne la propose pas.
  const mine = ownedBy(state, me).filter((i) => state.tiles[i].level === 0);
  const theirs = to ? ownedBy(state, to).filter((i) => state.tiles[i].level === 0) : [];

  const flip = (list: TileIndex[], set: (v: TileIndex[]) => void, i: TileIndex) =>
    set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);

  const valid = to && (give.length || get.length || giveCash || getCash)
    && giveCash <= state.players[me].cash;

  return (
    <div className="sheet sheet--right" role="dialog" aria-label="Échanges">
      <div className="sheet__head">
        <div className="sheet__title">Échanges</div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={18} /></button>
      </div>

      <div className="sheet__scroll">
        {incoming.length > 0 && (
          <>
            <div className="label">Offres reçues</div>
            {incoming.map((o) => (
              <div className="holding" key={o.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{state.players[o.from].name}</strong> vous propose :
                  <div style={{ color: 'var(--success)', marginTop: 4 }}>
                    Vous recevez {[...o.giveTiles.map((i) => tileAt(i).name), o.giveCash ? euro(o.giveCash) : null].filter(Boolean).join(', ') || '—'}
                  </div>
                  <div style={{ color: 'var(--danger-lift)' }}>
                    Vous cédez {[...o.getTiles.map((i) => tileAt(i).name), o.getCash ? euro(o.getCash) : null].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--sm btn--ghost" style={{ flex: 1 }}
                    onClick={() => { audio.click(); send({ t: 'DECLINE_TRADE', by: me, id: o.id }); }}>
                    Refuser
                  </button>
                  <button className="btn btn--sm btn--primary" style={{ flex: 1 }}
                    onClick={() => { audio.buy(); send({ t: 'ACCEPT_TRADE', by: me, id: o.id }); }}>
                    Accepter
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {outgoing.length > 0 && (
          <>
            <div className="label" style={{ marginTop: 16 }}>Offres envoyées</div>
            {outgoing.map((o) => (
              <div className="holding" key={o.id}>
                <div style={{ flex: 1, fontSize: 13 }}>À {state.players[o.to].name} — en attente</div>
                <button className="btn btn--sm btn--ghost"
                  onClick={() => send({ t: 'DECLINE_TRADE', by: me, id: o.id })}>Annuler</button>
              </div>
            ))}
          </>
        )}

        <div className="label" style={{ marginTop: 20 }}>Nouvelle offre</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {others.map((id) => (
            <button key={id} className="pill-opt" aria-pressed={to === id}
              onClick={() => { setTo(id); setGive([]); setGet([]); }}>
              {state.players[id].name}
            </button>
          ))}
        </div>

        <div className="label">Vous donnez</div>
        <Toggle tiles={mine} selected={give} onToggle={(i) => flip(give, setGive, i)}
          empty="Aucune propriété libre de construction." />
        <input className="input" style={{ marginTop: 8 }} type="number" min={0} max={state.players[me].cash}
          value={giveCash || ''} placeholder="Liquidités (€)"
          onChange={(e) => setGiveCash(Math.max(0, Number(e.target.value) || 0))} />

        <div className="label" style={{ marginTop: 18 }}>Vous recevez</div>
        <Toggle tiles={theirs} selected={get} onToggle={(i) => flip(get, setGet, i)}
          empty="Ce joueur n’a rien d’échangeable." />
        <input className="input" style={{ marginTop: 8 }} type="number" min={0}
          value={getCash || ''} placeholder="Liquidités demandées (€)"
          onChange={(e) => setGetCash(Math.max(0, Number(e.target.value) || 0))} />

        <button
          className="btn btn--accent btn--block"
          style={{ marginTop: 18, marginBottom: 8 }}
          disabled={!valid}
          onClick={() => {
            audio.click();
            send({ t: 'PROPOSE_TRADE', by: me, offer: { to, giveTiles: give, giveCash, getTiles: get, getCash } });
            setGive([]); setGet([]); setGiveCash(0); setGetCash(0);
          }}
        >
          <Icon name="swap" size={16} /> Proposer l’échange
        </button>
      </div>
    </div>
  );
};
