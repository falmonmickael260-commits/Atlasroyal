import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoom } from '../net/room';
import { RULES, tileAt } from '../engine/board';
import { liquidationValue, netWorth, ownedBy } from '../engine/rules';
import { Rules } from './Rules';
import { RollResult } from './panels/RollResult';
import { Scene } from '../board3d/Scene';
import { audio } from '../audio/audio';
import { useCinematic } from './cinema';
import { useCompact } from './useCompact';
import { Icon } from './Icon';
import { euro } from './format';
import { BannerLayer } from './panels/BannerLayer';
import { TokenLabels } from './panels/TokenLabels';
import { TradeTicker } from './panels/TradeTicker';
import { CardOverlay } from './panels/CardOverlay';
import { PropertyPrompt } from './panels/PropertyPrompt';
import { Portfolio } from './panels/Portfolio';
import { TradePanel } from './panels/TradePanel';
import { Victory } from './panels/Victory';
import { CashFlight } from './panels/CashFlight';
import './Game.css';

type Drawer = 'none' | 'portfolio' | 'trade' | 'rules';

export const Game = () => {
  const { state, identity, send, leaveRoom } = useRoom();
  const cinema = useCinematic();
  const compact = useCompact();
  const [drawer, setDrawer] = useState<Drawer>('none');
  const [tradeView,setTradeView]=useState<'incoming'|'outgoing'|null>(null);
  const [tradePartner,setTradePartner]=useState<string|null>(null);
  const [boardReady,setBoardReady] = useState(false);
  const [glLost, setGlLost] = useState(false);
  // Pont entre les étiquettes DOM et la scène, qui les positionne.
  const labels = useRef<Map<string, HTMLElement | null>>(new Map());
  const registerLabels = useCallback((m: Map<string, HTMLElement | null>) => {
    labels.current = m;
  }, []);
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
  const busy = cinema.playing || !boardReady;
  const player = state.players[me];
  const spectator = !player;

  const incoming = state.trades.filter((t) => t.to === me).length;
  const openTrades=()=>{setTradePartner(null);setTradeView(null);setDrawer('trade');};

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

    if (pending?.type === 'DEBT') {
      return <>
        <div><div className="actions__turn">Règlement de {state.players[pending.player].name}</div><div className="actions__hint">{euro(pending.debt.amount)} à réunir avant de poursuivre.</div></div>
        <button className="btn btn--ghost" onClick={()=>setDrawer('portfolio')}><Icon name="building" size={16}/>Patrimoine</button>
        <button className="btn btn--ghost" onClick={openTrades}><Icon name="swap" size={16}/>Échanges{incoming>0&&<span className="exchange-count">{incoming}</span>}</button>
      </>;
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
          <button className="btn btn--ghost" onClick={openTrades}>
            <Icon name="swap" size={16} /> Échanges{incoming > 0 && <span className="exchange-count">{incoming}</span>}
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
            <div className="actions__turn" style={{ color: 'var(--gold)' }}>{state.doubles > 0 ? 'Double ! À vous de rejouer' : 'À vous de jouer'}</div>
            <div className="actions__hint">
              {state.doubles > 0 ? `Double ! Vous rejouez (${state.doubles}/2).` : (state.round < RULES.purchasesFromRound ? `Tour ${state.round} · Achats ouverts au tour ${RULES.purchasesFromRound}` : `Tour ${state.round}`)}
            </div>
          </div>
          <button className="btn btn--ghost" onClick={() => setDrawer('portfolio')}>
            <Icon name="building" size={16} /> Patrimoine
          </button>
          <button className="btn btn--ghost" onClick={openTrades}>
            <Icon name="swap" size={16} /> Échanges{incoming > 0 && <span className="exchange-count">{incoming}</span>}
          </button>
          <button className="btn btn--accent btn--lg" disabled={busy}
            onClick={() => { audio.unlock(); send({ t: 'ROLL_DICE', by: me }); }}>
            <Icon name="dice" size={20} /> {busy ? (!boardReady ? 'Préparation du plateau…' : 'Déplacement en cours…') : state.doubles > 0 ? 'Relancer — double !' : 'Lancer les dés'}
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
        <button className="btn btn--ghost" onClick={openTrades}>
          <Icon name="swap" size={16} /> Échanges{incoming > 0 && <span className="exchange-count">{incoming}</span>}
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
          onReadyChange={setBoardReady}
          compact={compact}
          activePlayer={state.order[state.currentIndex]}
          onContextLost={() => setGlLost(true)}
          labels={labels}
        />
      </div>

      <div className="hud-top">
        <div className="brand glass">
          <img className="brand__logo" src={`${import.meta.env.BASE_URL}ui/logo.webp`} alt="Fortune Empire"/>
          <span className="brand__round">TOUR {state.round}</span>
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
          <button className="icon-btn" aria-label="Règles du jeu" onClick={()=>setDrawer('rules')}>
            <Icon name="school" size={18} />
          </button>
          <button className="icon-btn" aria-label="Quitter la partie" onClick={leaveRoom}>
            <Icon name="exit" size={18} />
          </button>
        </div>
      </div>

      <div className="turn-indicator" style={{['--turn-color' as string]:current.color}}><span/><div><small>{myTurn?'VOTRE TOUR':'À LA TABLE'}</small><strong>{current.name}{busy?' · action en cours':''}</strong></div></div>
      <div className="rail" aria-label="Joueurs et fortunes">
        {state.order.map((id) => {
          const p = state.players[id];
          const active = state.order[state.currentIndex] === id;
          return (
            <div
              key={id}
              className={`pcard${active ? ' pcard--active' : ''}${id===me?' pcard--me':''}${p.bankrupt ? ' pcard--out' : ''}`}
              style={{ ['--pc' as string]: p.color }}
              data-player={id}
            >
              <span className="pcard__dot"><Icon name="home" size={16} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pcard__name">{p.name}{id === me ? ' · vous' : ''}</div>
                <div className="pcard__cash mono-num"><span>Liquidités</span>{euro(p.cash)}</div>
                <div className="pcard__meta">
                  <span>{ownedBy(state, id).length} propriété{ownedBy(state, id).length > 1 ? 's' : ''}</span>
                  <span title="Valeur totale du patrimoine">Patrimoine {euro(netWorth(state, id))}</span>
                </div>
              </div>
              {id!==me&&!p.bankrupt&&<button className="pcard__trade" aria-label={`Négocier avec ${p.name}`} onClick={()=>{setTradePartner(id);setTradeView(null);setDrawer('trade');}}><Icon name="swap" size={15}/></button>}
              {p.inJail && <span className="pcard__tag pcard__tag--jail">Prison</span>}
              {!p.connected && !p.bankrupt && <span className="pcard__tag pcard__tag--off" title="Sa place et ses biens sont réservés pour son retour">Déconnecté · retour possible</span>}
            </div>
          );
        })}
      </div>

      <RollResult dice={cinema.dice} state={state} me={me} />
      <TokenLabels state={state} register={registerLabels} />
      {!spectator && <TradeTicker state={state} me={me} onOpen={view=>{setTradePartner(null);setTradeView(view);setDrawer('trade');}} />}
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

      {drawer === 'rules' && <div className="sheet sheet--right" role="dialog" aria-label="Règles du jeu">
        <div className="sheet__head"><span className="sheet__title">Règles de Fortune Empire</span><button className="icon-btn" aria-label="Fermer les règles" onClick={()=>setDrawer('none')}><Icon name="close" size={18}/></button></div>
        <div className="sheet__scroll"><Rules/></div>
      </div>}
      {!spectator && drawer === 'portfolio' && (
        <Portfolio state={state} me={me} send={send} onClose={() => setDrawer('none')} />
      )}
      {!spectator && (
        <TradePanel state={state} me={me} send={send} open={drawer==='trade'} partner={tradePartner} view={tradeView} onClose={() => setDrawer('none')} />
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
