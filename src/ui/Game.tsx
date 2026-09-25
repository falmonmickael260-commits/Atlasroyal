import { useEffect, useState } from 'react';
import { useRoom } from '../net/room';
import { RULES, tileAt } from '../engine/board';
import { liquidationValue, netWorth, ownedBy } from '../engine/rules';
import { Scene } from '../board3d/Scene';
import { audio } from '../audio/audio';
import { useCinematic } from './cinema';
import { useCompact, useQuality } from './useCompact';
import { Icon } from './Icon';
import { euro } from './format';
import { BannerLayer } from './panels/BannerLayer';
import { CardOverlay } from './panels/CardOverlay';
import { PropertyPrompt } from './panels/PropertyPrompt';
import { Portfolio } from './panels/Portfolio';
import { TradePanel } from './panels/TradePanel';
import { Victory } from './panels/Victory';
import { CashFlight } from './panels/CashFlight';
import './Game.css';

type Drawer = 'none' | 'portfolio' | 'trade';

export const Game = () => {
  const { state, identity, send, leaveRoom } = useRoom();
  const cinema = useCinematic();
  const compact = useCompact();
  const quality = useQuality();
  const [drawer, setDrawer] = useState<Drawer>('none');
  const [glLost, setGlLost] = useState(false);
  const [sfx, setSfx] = useState(audio.sfxOn);
  const [music, setMusic] = useState(audio.musicOn);

  useEffect(() => { audio.unlock(); }, []);

  if (!state) {
    return (
      <div className="game" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ color: 'var(--fg-muted)' }}>Synchronisation de la partie…</div>
      </div>
    );
  }

  const me = identity.id;
  const myTurn = state.order[state.currentIndex] === me;
  const current = state.players[state.order[state.currentIndex]];
  const pending = state.pending;
  const iAmPending = pending && 'player' in pending && pending.player === me;
  const busy = cinema.playing;
  const player = state.players[me];
  const spectator = !player;

  const incoming = state.trades.filter((t) => t.to === me).length;

  /* ------------------------ barre d'action ------------------------ */
  const renderActions = () => {
    if (state.phase === 'GAME_OVER') return null;

    if (pending?.type === 'DEBT' && pending.player === me) {
      const canPay = player.cash >= pending.debt.amount;
      const canRaise = liquidationValue(state, me) >= pending.debt.amount;
      return (
        <>
          <div>
            <div className="actions__turn" style={{ color: 'var(--danger-lift)' }}>
              Dette de {euro(pending.debt.amount)}
            </div>
            <div className="actions__hint">
              {canPay
                ? 'Vous pouvez régler.'
                : canRaise
                  ? 'Vendez des constructions, hypothéquez ou négociez pour réunir la somme.'
                  : 'Aucune solution ne couvre la dette.'}
            </div>
          </div>
          <button className="btn btn--ghost" onClick={() => setDrawer('portfolio')}>
            <Icon name="bank" size={16} /> Lever des fonds
          </button>
          {canPay ? (
            <button className="btn btn--primary" onClick={() => send({ t: 'SETTLE_DEBT', by: me })}>
              <Icon name="check" size={16} /> Régler
            </button>
          ) : (
            <button className="btn btn--danger" onClick={() => send({ t: 'DECLARE_BANKRUPTCY', by: me })}>
              <Icon name="close" size={16} /> Déclarer faillite
            </button>
          )}
        </>
      );
    }

    if (!myTurn) {
      return (
        <>
          <div>
            <div className="actions__turn" style={{ color: current.color }}>
              Tour de {current.name}
            </div>
            <div className="actions__hint">
              {busy ? 'Action en cours…' : 'Vous pouvez préparer un échange en attendant.'}
            </div>
          </div>
          <button className="btn btn--ghost" onClick={() => setDrawer('portfolio')}>
            <Icon name="building" size={16} /> Patrimoine
          </button>
          <button className="btn btn--ghost" onClick={() => setDrawer('trade')}>
            <Icon name="swap" size={16} /> Échanges{incoming ? ` (${incoming})` : ''}
          </button>
        </>
      );
    }

    if (state.phase === 'JAIL' && player.inJail) {
      return (
        <>
          <div>
            <div className="actions__turn">Prison — tentative {player.jailAttempts + 1}/{RULES.jailMaxAttempts}</div>
            <div className="actions__hint">Un double vous libère et vous déplace. Trois échecs : caution obligatoire.</div>
          </div>
          <button className="btn btn--ghost" disabled={busy} onClick={() => send({ t: 'ATTEMPT_JAIL_ROLL', by: me })}>
            <Icon name="dice" size={16} /> Tenter un double
          </button>
          {player.jailFreeCards > 0 && (
            <button className="btn btn--primary" disabled={busy} onClick={() => send({ t: 'USE_JAIL_CARD', by: me })}>
              <Icon name="card" size={16} /> Laissez-passer
            </button>
          )}
          <button className="btn btn--accent" disabled={busy || player.cash < RULES.jailFine}
            onClick={() => send({ t: 'PAY_JAIL_FINE', by: me })}>
            <Icon name="coins" size={16} /> Payer {euro(RULES.jailFine)}
          </button>
        </>
      );
    }

    if (state.phase === 'ROLL_DICE') {
      return (
        <>
          <div>
            <div className="actions__turn" style={{ color: 'var(--gold)' }}>À vous de jouer</div>
            <div className="actions__hint">
              {state.doubles > 0 ? `Double ! Vous rejouez (${state.doubles}/2).` : `Tour ${state.round}`}
            </div>
          </div>
          <button className="btn btn--ghost" onClick={() => setDrawer('portfolio')}>
            <Icon name="building" size={16} /> Patrimoine
          </button>
          <button className="btn btn--ghost" onClick={() => setDrawer('trade')}>
            <Icon name="swap" size={16} />{incoming ? ` (${incoming})` : ''}
          </button>
          <button className="btn btn--accent btn--lg" disabled={busy}
            onClick={() => { audio.unlock(); send({ t: 'ROLL_DICE', by: me }); }}>
            <Icon name="dice" size={20} /> Lancer les dés
          </button>
        </>
      );
    }

    return (
      <>
        <div>
          <div className="actions__turn">Votre tour</div>
          <div className="actions__hint">Construisez, négociez, puis passez la main.</div>
        </div>
        <button className="btn btn--ghost" onClick={() => setDrawer('portfolio')}>
          <Icon name="building" size={16} /> Patrimoine
        </button>
        <button className="btn btn--ghost" onClick={() => setDrawer('trade')}>
          <Icon name="swap" size={16} /> Échanges{incoming ? ` (${incoming})` : ''}
        </button>
        <button className="btn btn--primary" disabled={busy || Boolean(pending)}
          onClick={() => send({ t: 'END_TURN', by: me })}>
          <Icon name="check" size={16} /> Terminer le tour
        </button>
      </>
    );
  };

  return (
    <div className="game">
      <div className="game__stage">
        <Scene
          state={state}
          cinema={cinema}
          compact={compact}
          quality={quality}
          activePlayer={state.order[state.currentIndex]}
          onContextLost={() => setGlLost(true)}
        />
      </div>

      <div className="hud-top">
        <div className="brand glass">
          <span className="brand__mark">ATLAS ROYALE</span>
          <span className="brand__round">Tour {state.round}</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <div className="pot glass" data-pot>
            <Icon name="coins" size={18} style={{ color: 'var(--gold)' }} />
            <div>
              <div className="pot__label">Cagnotte</div>
              <div className="pot__value mono-num">{euro(state.pot)}</div>
            </div>
          </div>
          <button className="icon-btn" aria-pressed={sfx} aria-label="Effets sonores"
            onClick={() => { audio.unlock(); audio.setSfx(!sfx); setSfx(!sfx); }}>
            <Icon name={sfx ? 'sound' : 'mute'} size={18} />
          </button>
          <button className="icon-btn" aria-pressed={music} aria-label="Musique"
            onClick={() => { audio.unlock(); audio.setMusic(!music); setMusic(!music); }}>
            <Icon name="music" size={18} />
          </button>
          <button className="icon-btn" aria-label="Quitter la partie" onClick={leaveRoom}>
            <Icon name="exit" size={18} />
          </button>
        </div>
      </div>

      <div className="rail">
        {state.order.map((id) => {
          const p = state.players[id];
          const active = state.order[state.currentIndex] === id;
          return (
            <div
              key={id}
              className={`pcard${active ? ' pcard--active' : ''}${p.bankrupt ? ' pcard--out' : ''}`}
              style={{ ['--pc' as string]: p.color }}
              data-player={id}
            >
              <span className="pcard__dot"><Icon name="home" size={16} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pcard__name">{p.name}{id === me ? ' · vous' : ''}</div>
                <div className="pcard__cash mono-num">{euro(p.cash)}</div>
                <div className="pcard__meta">
                  <span>{ownedBy(state, id).length} villes</span>
                  <span>{euro(netWorth(state, id))}</span>
                </div>
              </div>
              {p.inJail && <span className="pcard__tag pcard__tag--jail">Prison</span>}
              {!p.connected && !p.bankrupt && <span className="pcard__tag pcard__tag--off">Hors ligne</span>}
            </div>
          );
        })}
      </div>

      <BannerLayer banner={cinema.banner} />
      <CashFlight fly={cinema.cashFly} />
      <CardOverlay cardId={cinema.card} />

      {pending?.type === 'PROPERTY_DECISION' && iAmPending && !busy && (
        <PropertyPrompt
          state={state}
          tile={pending.tile}
          price={pending.price}
          cash={player.cash}
          onBuy={() => send({ t: 'BUY_PROPERTY', by: me })}
          onDecline={() => send({ t: 'DECLINE_PROPERTY', by: me })}
        />
      )}

      {pending?.type === 'PROPERTY_DECISION' && !iAmPending && (
        <div className="sheet sheet--center" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
            {state.players[pending.player].name} décide pour
          </div>
          <div className="sheet__title" style={{ marginTop: 6 }}>{tileAt(pending.tile).name}</div>
        </div>
      )}

      {!spectator && drawer === 'portfolio' && (
        <Portfolio state={state} me={me} send={send} onClose={() => setDrawer('none')} />
      )}
      {!spectator && drawer === 'trade' && (
        <TradePanel state={state} me={me} send={send} onClose={() => setDrawer('none')} />
      )}

      {!spectator && (
        <div className="actions">{renderActions()}</div>
      )}

      {glLost && (
        <div className="sheet sheet--center" role="alert" style={{ textAlign: 'center' }}>
          <div className="sheet__title">Rendu 3D interrompu</div>
          <p style={{ color: 'var(--fg-muted)', fontSize: 14, marginTop: 8 }}>
            Le contexte graphique a été perdu (mise en veille ou changement de carte graphique).
            La partie continue côté serveur : rechargez pour retrouver le plateau.
          </p>
          <button className="btn btn--accent btn--block" style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}>
            <Icon name="spark" size={16} /> Recharger le plateau
          </button>
        </div>
      )}

      {state.phase === 'GAME_OVER' && <Victory state={state} onLeave={leaveRoom} />}
    </div>
  );
};
