import { useEffect, useRef, useState } from 'react';
import { ownedBy } from '../../engine/rules';
import { tileAt } from '../../engine/board';
import { useRoom } from '../../net/room';
import { Icon } from '../Icon';
import { euro } from '../format';
import { audio } from '../../audio/audio';
import { TileChip } from './TradeTicker';
import { TradeAsset, TradeBundle, catalogueValue } from './TradeAssets';
import type { Command, GameState, PlayerId, TradeOffer } from '../../engine/types';
import './TradePanel.css';

type Tab = 'compose' | 'incoming' | 'outgoing';
type Draft = {
  to: PlayerId;
  give: number[];
  get: number[];
  giveCash: string;
  getCash: string;
  counter: string | null;
};
type Pending = {
  kind: 'send' | 'accept' | 'decline' | 'withdraw';
  id?: string;
  offer?: Omit<TradeOffer, 'id' | 'from'>;
  existing: string[];
  toastAt: string | null;
};
const emptyDraft = (to: string): Draft => ({
  to,
  give: [],
  get: [],
  giveCash: '',
  getCash: '',
  counter: null,
});
const sameTiles = (a: number[], b: number[]) =>
  a.length === b.length && a.every((i) => b.includes(i));
const amount = (value: string) => (value.trim() === '' ? 0 : Number(value));
const validAmount = (value: number) => Number.isSafeInteger(value) && value >= 0;
const checkOffer = (state: GameState, offer: TradeOffer) => {
  if (!state.players[offer.from] || state.players[offer.from].bankrupt)
    return 'Ce joueur ne participe plus à la partie.';
  if (
    offer.giveTiles.some((i) => state.tiles[i]?.owner !== offer.from) ||
    offer.getTiles.some((i) => state.tiles[i]?.owner !== offer.to)
  )
    return 'Une propriété a changé de propriétaire. Préparez une nouvelle offre.';
  if ([...offer.giveTiles, ...offer.getTiles].some((i) => state.tiles[i]?.level > 0))
    return 'Des constructions doivent être revendues avant cet échange.';
  if (state.players[offer.from].cash < offer.giveCash)
    return `${state.players[offer.from].name} doit réunir les liquidités proposées.`;
  if (state.players[offer.to].cash < offer.getCash)
    return `${state.players[offer.to].name} doit réunir les liquidités demandées.`;
  return null;
};

const MoneyField = ({
  id,
  value,
  onChange,
  balance,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  balance: number;
  label: string;
}) => (
  <div className="trade-cash">
    <label htmlFor={id}>
      {label}
      <span>Disponible : {euro(balance)}</span>
    </label>
    <div className="trade-cash__input">
      <Icon name="coins" size={19} />
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
      />
      <span>€</span>
    </div>
    <div className="trade-cash__quick">
      {[50, 100].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(String(Math.min(balance, Math.max(0, amount(value) || 0) + n)))}
        >
          +{n} €
        </button>
      ))}
      <button type="button" onClick={() => onChange(String(balance))}>
        Tout
      </button>
      <button type="button" onClick={() => onChange('')}>
        Effacer
      </button>
    </div>
  </div>
);

/** The original commands and authority retain ownership of every transaction. */
export const TradePanel = ({
  state,
  me,
  onClose,
  send,
  open = true,
  partner,
  view,
}: {
  state: GameState;
  me: PlayerId;
  onClose: () => void;
  send: (c: Command) => void;
  open?: boolean;
  partner?: PlayerId | null;
  view?: 'incoming' | 'outgoing' | null;
}) => {
  const others = state.order.filter((id) => id !== me && !state.players[id].bankrupt);
  const incoming = state.trades.filter((t) => t.to === me);
  const outgoing = state.trades.filter((t) => t.from === me);
  const [tab, setTab] = useState<Tab>(incoming.length ? 'incoming' : 'compose');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(others[0] ?? ''));
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'warning'>('info');
  const [pending, setPending] = useState<Pending | null>(null);
  const toast = useRoom((s) => s.toast);
  const events = useRoom((s) => s.queue);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const opened = useRef(false);
  const selectedPartner = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      opened.current = false;
      return;
    }
    if (
      partner &&
      partner !== me &&
      !state.players[partner]?.bankrupt &&
      partner !== selectedPartner.current
    ) {
      setDraft(emptyDraft(partner));
      setSearch('');
      setTab('compose');
      setNotice('');
    } else if (!opened.current && incoming.length) setTab('incoming');
    selectedPartner.current = partner ?? null;
    opened.current = true;
  }, [open, partner, me, incoming.length, state.players]);

  useEffect(() => {
    if (open && view) setTab(view);
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const box = dialog.current;
    const focusable = () =>
      Array.from(
        box?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    const timer = window.setTimeout(() => focusable()[0]?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          event.preventDefault();
          box?.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || !box?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !box?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!pending) return;
    if (pending.kind === 'send' && pending.offer) {
      const sent = state.trades.find(
        (o) =>
          o.from === me &&
          !pending.existing.includes(o.id) &&
          o.to === pending.offer!.to &&
          o.giveCash === pending.offer!.giveCash &&
          o.getCash === pending.offer!.getCash &&
          sameTiles(o.giveTiles, pending.offer!.giveTiles) &&
          sameTiles(o.getTiles, pending.offer!.getTiles),
      );
      if (sent) {
        setNoticeTone('success');
        setNotice(`Offre envoyée à ${state.players[sent.to].name}. À ce joueur de répondre.`);
        setDraft(emptyDraft(sent.to));
        setTab('outgoing');
        setPending(null);
      }
    } else if (pending.id && !state.trades.some((o) => o.id === pending.id)) {
      const accepted = events.some((e) => e.e === 'TRADE_ACCEPTED' && e.offer.id === pending.id);
      setNoticeTone(pending.kind === 'accept' && !accepted ? 'info' : 'success');
      setNotice(
        pending.kind === 'accept'
          ? accepted
            ? 'Échange accepté. Vos propriétés et vos liquidités sont à jour.'
            : 'Cette offre n’est plus disponible. Retrouvez vos autres propositions ci-dessous.'
          : pending.kind === 'withdraw'
            ? 'Votre offre a été retirée.'
            : 'L’offre a été refusée.',
      );
      setPending(null);
    }
  }, [pending, state, me, events]);
  useEffect(() => {
    if (pending && toast && toast !== pending.toastAt) {
      setNoticeTone('warning');
      setNotice(toast);
      setPending(null);
    }
  }, [toast, pending]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setPending(null);
      setNoticeTone('warning');
      setNotice(
        'La réponse tarde. Votre proposition reste conservée ; vérifiez les offres envoyées avant de réessayer.',
      );
    }, 8000);
    return () => clearTimeout(timer);
  }, [pending]);

  const mePlayer = state.players[me];
  const target = state.players[draft.to];
  const giving = amount(draft.giveCash),
    getting = amount(draft.getCash);
  const selected = [...draft.give, ...draft.get];
  const stale =
    draft.give.some((i) => state.tiles[i]?.owner !== me || state.tiles[i].level > 0) ||
    draft.get.some((i) => state.tiles[i]?.owner !== draft.to || state.tiles[i].level > 0);
  const error =
    !target || target.bankrupt
      ? 'Choisissez un partenaire.'
      : !validAmount(giving) || !validAmount(getting)
        ? 'Les montants doivent être des euros entiers, positifs ou nuls.'
        : stale
          ? 'Une propriété sélectionnée a changé. Retirez-la de votre proposition.'
          : !draft.give.length && !giving
            ? 'Ajoutez ce que vous donnez.'
            : !draft.get.length && !getting
              ? 'Ajoutez ce que vous recevez.'
              : giving > mePlayer.cash
                ? 'Votre solde ne couvre pas les liquidités proposées.'
                : null;
  const mine = ownedBy(state, me);
  const theirs = target ? ownedBy(state, draft.to) : [];
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  const filtered = (tiles: number[]) =>
    tiles.filter((i) => normalize(tileAt(i).name).includes(normalize(search)));
  const patch = (values: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...values }));
    setNotice('');
  };
  const toggle = (side: 'give' | 'get', tile: number) => {
    audio.click();
    setDraft((d) => ({
      ...d,
      [side]: d[side].includes(tile) ? d[side].filter((i) => i !== tile) : [...d[side], tile],
    }));
    setNotice('');
  };
  const counter = (offer: TradeOffer) => {
    setDraft({
      to: offer.from,
      give: [...offer.getTiles],
      get: [...offer.giveTiles],
      giveCash: String(offer.getCash || ''),
      getCash: String(offer.giveCash || ''),
      counter: offer.id,
    });
    setTab('compose');
    setSearch('');
    setNoticeTone('info');
    setNotice('Adaptez les biens ou les montants, puis envoyez votre contre-proposition.');
  };
  const submit = () => {
    if (error || pending) return;
    const offer = {
      to: draft.to,
      giveTiles: [...draft.give],
      getTiles: [...draft.get],
      giveCash: giving,
      getCash: getting,
    };
    setPending({ kind: 'send', offer, existing: state.trades.map((o) => o.id), toastAt: toast });
    setNotice('');
    audio.click();
    if (draft.counter && state.trades.some((o) => o.id === draft.counter && o.to === me))
      send({ t: 'DECLINE_TRADE', by: me, id: draft.counter });
    send({ t: 'PROPOSE_TRADE', by: me, offer });
  };
  const respond = (offer: TradeOffer, kind: 'accept' | 'decline' | 'withdraw') => {
    if (pending) return;
    setPending({ kind, id: offer.id, existing: [], toastAt: toast });
    setNotice('');
    audio.click();
    send({ t: kind === 'accept' ? 'ACCEPT_TRADE' : 'DECLINE_TRADE', by: me, id: offer.id });
  };
  const projected = (id: string, paid: number, received: number) =>
    euro(state.players[id].cash - paid + received);
  const list = tab === 'incoming' ? incoming : outgoing;
  if (!open) return null;
  return (
    <div
      className="trade-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="trade-desk"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
        tabIndex={-1}
      >
        <header className="trade-head">
          <span className="trade-head__seal">
            <Icon name="swap" size={25} />
          </span>
          <div>
            <span className="trade-eyebrow">FORTUNE EMPIRE · NÉGOCIATIONS</span>
            <h2 id="trade-title">Le comptoir des échanges</h2>
            <p>Un accord se construit à deux.</p>
          </div>
          <button className="icon-btn" aria-label="Fermer les échanges" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </header>
        <nav className="trade-tabs" aria-label="Vue des échanges">
          {(
            [
              ['compose', draft.counter ? 'Contre-proposition' : 'Nouvelle offre', null],
              ['incoming', 'Reçues', incoming.length],
              ['outgoing', 'Envoyées', outgoing.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => {
                audio.click();
                setTab(key);
              }}
            >
              {label}
              {count !== null && <span>{count}</span>}
            </button>
          ))}
        </nav>
        {notice && (
          <div className={`trade-notice trade-notice--${noticeTone}`} role="status">
            <Icon
              name={noticeTone === 'success' ? 'check' : noticeTone === 'warning' ? 'eye' : 'swap'}
              size={17}
            />
            {notice}
          </div>
        )}
        <div className="trade-body">
          {tab === 'compose' ? (
            <fieldset
              disabled={!!pending}
              className="trade-compose-fields"
              aria-label="Composition de l’offre"
            >
              <div className="trade-partner-head">
                <span className="trade-section-label">01 · Choisissez votre partenaire</span>
                <button
                  className="trade-text-button"
                  disabled={!!pending}
                  onClick={() => {
                    setDraft(emptyDraft(others.includes(draft.to) ? draft.to : (others[0] ?? '')));
                    setSearch('');
                    setNotice('');
                  }}
                >
                  Réinitialiser l’offre
                </button>
              </div>
              <div className="trade-partners" aria-label="Partenaire de l’échange">
                {others.map((id) => (
                  <button
                    key={id}
                    aria-pressed={draft.to === id}
                    style={{ ['--partner-color' as string]: state.players[id].color }}
                    onClick={() => {
                      if (draft.to === id) return;
                      setDraft(emptyDraft(id));
                      setSearch('');
                      setNotice('');
                    }}
                  >
                    <i />
                    {state.players[id].name}
                    <span>{euro(state.players[id].cash)}</span>
                  </button>
                ))}
              </div>
              {!others.length && <p className="trade-empty">Aucun autre joueur disponible.</p>}
              {draft.counter && (
                <div className="trade-counter-note">
                  <Icon name="swap" size={17} />
                  <span>
                    Contre-proposition à {target?.name}. L’offre initiale sera remplacée à l’envoi.
                  </span>
                  <button onClick={() => patch({ counter: null })}>Offre indépendante</button>
                </div>
              )}
              <div className="trade-search-row">
                <span className="trade-section-label">02 · Composez votre accord</span>
                <label className="trade-search">
                  <Icon name="eye" size={16} />
                  <input
                    aria-label="Rechercher une propriété"
                    placeholder="Rechercher une ville…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="trade-columns">
                {(['give', 'get'] as const).map((side, index) => {
                  const owner = index === 0 ? mePlayer : target;
                  const available = index === 0 ? mine : theirs;
                  const cash = index === 0 ? draft.giveCash : draft.getCash;
                  const picked = draft[side];
                  return (
                    <section
                      className={`trade-side trade-side--${side}`}
                      key={side}
                      aria-label={index === 0 ? 'Vous donnez' : 'Vous recevez'}
                    >
                      <header className="trade-side__head">
                        <span className="trade-side__number">{index === 0 ? '→' : '←'}</span>
                        <div>
                          <h3>{index === 0 ? 'Vous donnez' : 'Vous recevez'}</h3>
                          <p>
                            {owner?.name ?? 'Choisissez un joueur'}
                            <span>
                              {picked.length} bien{picked.length > 1 ? 's' : ''} sélectionné
                              {picked.length > 1 ? 's' : ''}
                            </span>
                          </p>
                        </div>
                      </header>
                      <div className="trade-properties">
                        {filtered(available).map((tile) => (
                          <TradeAsset
                            key={tile}
                            tile={tile}
                            state={state}
                            selected={picked.includes(tile)}
                            onToggle={() => toggle(side, tile)}
                          />
                        ))}
                        {!available.length && (
                          <div className="trade-empty-assets">
                            <Icon name="building" size={28} />
                            <strong>Aucun titre de propriété</strong>
                            <span>
                              {index === 0
                                ? 'Vous pouvez proposer des liquidités.'
                                : 'Vous pouvez demander des liquidités.'}
                            </span>
                          </div>
                        )}
                        {available.length > 0 && !filtered(available).length && (
                          <p className="trade-empty">Aucune propriété ne correspond.</p>
                        )}
                      </div>
                      <MoneyField
                        id={index === 0 ? 'trade-give-cash' : 'trade-get-cash'}
                        label={index === 0 ? 'Liquidités proposées' : 'Liquidités demandées'}
                        value={cash}
                        balance={owner?.cash ?? 0}
                        onChange={(v) => patch(index === 0 ? { giveCash: v } : { getCash: v })}
                      />
                    </section>
                  );
                })}
              </div>
              {selected.some((i) => state.tiles[i]?.mortgaged) && (
                <p className="trade-footnote">
                  Les hypothèques restent attachées aux propriétés échangées.
                </p>
              )}
              {stale && (
                <div className="trade-warning">
                  {error}
                  <button
                    onClick={() =>
                      patch({
                        give: draft.give.filter(
                          (i) => state.tiles[i]?.owner === me && !state.tiles[i]?.level,
                        ),
                        get: draft.get.filter(
                          (i) => state.tiles[i]?.owner === draft.to && !state.tiles[i]?.level,
                        ),
                      })
                    }
                  >
                    Actualiser la sélection
                  </button>
                </div>
              )}
              {target && validAmount(getting) && getting > target.cash && (
                <p className="trade-warning">
                  {target.name} devra réunir {euro(getting - target.cash)} pour accepter cette
                  offre.
                </p>
              )}
            </fieldset>
          ) : (
            <>
              <div className="trade-list-intro">
                <h3>{tab === 'incoming' ? 'Vos offres reçues' : 'Vos offres en attente'}</h3>
                <p>
                  {tab === 'incoming'
                    ? 'Comparez les deux côtés avant de décider.'
                    : 'Vous pouvez retirer une offre tant qu’elle n’est pas acceptée.'}
                </p>
              </div>
              {!list.length && (
                <div className="trade-empty-inbox">
                  <span>
                    <Icon name={tab === 'incoming' ? 'card' : 'swap'} size={36} />
                  </span>
                  <h3>
                    {tab === 'incoming' ? 'Aucune offre pour le moment' : 'Aucune offre en attente'}
                  </h3>
                  <p>
                    {tab === 'incoming'
                      ? 'Les propositions des autres joueurs apparaîtront ici.'
                      : 'Choisissez un partenaire et proposez votre premier accord.'}
                  </p>
                  <button className="btn btn--accent" onClick={() => setTab('compose')}>
                    Préparer une offre <Icon name="chevron" size={16} />
                  </button>
                </div>
              )}
              {list.map((offer) => {
                const received = offer.to === me,
                  partnerId = received ? offer.from : offer.to;
                const receiveTiles = received ? offer.giveTiles : offer.getTiles,
                  giveTiles = received ? offer.getTiles : offer.giveTiles;
                const receiveCash = received ? offer.giveCash : offer.getCash,
                  giveCash = received ? offer.getCash : offer.giveCash;
                const reason = checkOffer(state, offer);
                return (
                  <article
                    className="trade-offer"
                    key={offer.id}
                    aria-label={`Offre ${received ? 'de' : 'à'} ${state.players[partnerId].name}`}
                  >
                    <header className="trade-offer__head">
                      <span
                        className="trade-avatar"
                        style={{ ['--partner-color' as string]: state.players[partnerId].color }}
                      >
                        {state.players[partnerId].name.slice(0, 1)}
                      </span>
                      <div>
                        <h3>{state.players[partnerId].name}</h3>
                        <span>
                          {received ? 'vous propose un accord' : 'votre proposition est en attente'}
                        </span>
                      </div>
                      <span className="trade-offer__status">
                        {received ? 'À examiner' : 'En attente'}
                      </span>
                    </header>
                    <div className="trade-columns">
                      <section className="trade-side trade-side--give">
                        <header>
                          <h4>Vous cédez</h4>
                          <p>Votre côté de l’accord</p>
                        </header>
                        <TradeBundle tiles={giveTiles} cash={giveCash} state={state} />
                      </section>
                      <section className="trade-side trade-side--get">
                        <header>
                          <h4>Vous recevez</h4>
                          <p>En provenance de {state.players[partnerId].name}</p>
                        </header>
                        <TradeBundle tiles={receiveTiles} cash={receiveCash} state={state} />
                      </section>
                    </div>
                    <div className="trade-balance">
                      <span>
                        Vos liquidités après accord
                        <strong>{projected(me, giveCash, receiveCash)}</strong>
                      </span>
                      <span>
                        Solde de {state.players[partnerId].name}
                        <strong>{projected(partnerId, receiveCash, giveCash)}</strong>
                      </span>
                    </div>
                    {reason && <p className="trade-warning">{reason}</p>}
                    <footer className="trade-offer__actions">
                      {received ? (
                        <>
                          <button
                            className="btn btn--ghost"
                            disabled={!!pending}
                            onClick={() => respond(offer, 'decline')}
                          >
                            Refuser
                          </button>
                          <button
                            className="btn btn--ghost"
                            disabled={!!pending}
                            onClick={() => counter(offer)}
                          >
                            <Icon name="swap" size={16} />
                            Contre-proposer
                          </button>
                          <button
                            className="btn btn--accent"
                            disabled={!!pending || !!reason}
                            onClick={() => respond(offer, 'accept')}
                          >
                            <Icon name="check" size={16} />
                            Accepter l’échange
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn--ghost"
                          disabled={!!pending}
                          onClick={() => respond(offer, 'withdraw')}
                        >
                          Retirer cette offre
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })}
            </>
          )}
        </div>
        {tab === 'compose' ? (
          <footer className="trade-summary">
            <div className="trade-summary__items">
              <div>
                <span>Vous cédez</span>
                <div>
                  {draft.give.map((i) => (
                    <TileChip key={i} tile={i} />
                  ))}
                  {giving > 0 && validAmount(giving) && <b>{euro(giving)}</b>}
                  {!draft.give.length && !giving && <em>À compléter</em>}
                </div>
              </div>
              <Icon name="swap" size={19} />
              <div>
                <span>Vous recevez</span>
                <div>
                  {draft.get.map((i) => (
                    <TileChip key={i} tile={i} />
                  ))}
                  {getting > 0 && validAmount(getting) && <b>{euro(getting)}</b>}
                  {!draft.get.length && !getting && <em>À compléter</em>}
                </div>
              </div>
            </div>
            <div className="trade-summary__bottom">
              <div>
                <strong>
                  {validAmount(giving) && validAmount(getting)
                    ? `Après accord : ${euro(mePlayer.cash - giving + getting)}`
                    : 'Montant à corriger'}
                </strong>
                <span>
                  {error ??
                    `Valeur catalogue : ${euro(catalogueValue(draft.give, giving))} contre ${euro(catalogueValue(draft.get, getting))}`}
                </span>
                <small>Les biens seront transférés à l’acceptation de l’autre joueur.</small>
              </div>
              <button className="btn btn--accent" disabled={!!error || !!pending} onClick={submit}>
                <Icon name="swap" size={18} />
                {pending
                  ? 'Envoi en cours…'
                  : draft.counter
                    ? 'Envoyer la contre-proposition'
                    : 'Envoyer l’offre'}
              </button>
            </div>
          </footer>
        ) : (
          <footer className="trade-desk__foot">
            <Icon name="shield" size={15} />
            Un accord accepté transfère ensemble les propriétés et les liquidités.
          </footer>
        )}
      </div>
    </div>
  );
};
