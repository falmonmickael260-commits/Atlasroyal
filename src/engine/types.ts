/**
 * ATLAS ROYALE — types du moteur.
 * Aucun import React/DOM ici : ce module doit rester exécutable côté serveur.
 */

export type PlayerId = string;
export type TileIndex = number;

export type GroupId =
  | 'sable' | 'jade' | 'corail' | 'ambre'
  | 'cobalt' | 'pourpre' | 'argent' | 'or';

export type TileKind =
  | 'depart' | 'city' | 'hub' | 'reseau' | 'card'
  | 'tax' | 'prison' | 'gotoprison' | 'parc';

/** 0 = terrain nu, 1 = Maison, 2 = Villa, 3 = Grand Hôtel. */
export type BuildLevel = 0 | 1 | 2 | 3;

export interface CityTile {
  i: TileIndex;
  kind: 'city';
  name: string;
  country: string;
  group: GroupId;
  price: number;
  /** [terrain, maison, villa, grand hôtel] */
  rent: [number, number, number, number];
  buildCost: number;
  /** Repère visuel de la ville sur le plateau 3D. */
  landmark: 'tower' | 'dome' | 'spire' | 'arch' | 'pyramid' | 'bridge' | 'pagoda' | 'skyline';
  lat: number;
  lon: number;
}

export interface HubTile {
  i: TileIndex; kind: 'hub'; name: string; price: number;
}
export interface ReseauTile {
  i: TileIndex; kind: 'reseau'; name: string; price: number;
}
export interface CardTile {
  i: TileIndex; kind: 'card'; deck: DeckId; name: string;
}
export interface TaxTile {
  i: TileIndex; kind: 'tax'; name: string; amount: number;
}
export interface PlainTile {
  i: TileIndex; kind: 'depart' | 'prison' | 'gotoprison' | 'parc'; name: string;
}

export type Tile = CityTile | HubTile | ReseauTile | CardTile | TaxTile | PlainTile;
/** Les cases qui peuvent appartenir à un joueur. */
export type OwnableTile = CityTile | HubTile | ReseauTile;

export type DeckId = 'destin' | 'marche';
export type Rarity = 'commune' | 'rare' | 'legendaire';

export type CardEffect =
  | { k: 'cash'; amount: number }                                   // + banque / − vers cagnotte si négatif
  | { k: 'cashToPot'; amount: number }                              // paie vers la cagnotte
  | { k: 'collectFromEach'; amount: number }
  | { k: 'payEach'; amount: number }
  | { k: 'moveTo'; tile: TileIndex; collectGo: boolean }
  | { k: 'moveBy'; steps: number }
  | { k: 'moveToNearest'; target: 'hub' | 'reseau' }
  | { k: 'goToJail' }
  | { k: 'jailFree' }
  | { k: 'repairs'; perHouse: number; perVilla: number; perHotel: number }
  | { k: 'takePot' }
  | { k: 'cashPerProperty'; amount: number }
  | { k: 'discountNextPurchase'; percent: number }
  | { k: 'multi'; effects: CardEffect[] };

export interface CardDef {
  id: string;
  deck: DeckId;
  title: string;
  text: string;
  rarity: Rarity;
  /** Illustration procédurale choisie par l'UI. */
  art: string;
  tone: 'positif' | 'negatif' | 'neutre' | 'chaos';
  effect: CardEffect;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  avatar: string;
  color: string;
  token: string;
  cash: number;
  position: TileIndex;
  inJail: boolean;
  jailAttempts: number;
  jailFreeCards: number;
  bankrupt: boolean;
  connected: boolean;
  /** Remise en % sur le prochain achat (carte Marché). */
  purchaseDiscount: number;
  /** Nombre de tours complets joués — sert à la règle "pas d'achat au 1er tour". */
  roundsPlayed: number;
}

export interface TileState {
  owner: PlayerId | null;
  level: BuildLevel;
  mortgaged: boolean;
}

export type Phase =
  | 'LOBBY' | 'GAME_START' | 'ROLL_DICE' | 'DICE_RESULT' | 'MOVING' | 'LANDING'
  | 'PROPERTY_DECISION' | 'PAYMENT' | 'BUILDING' | 'CARD_EVENT' | 'JAIL'
  | 'TRADE' | 'DEBT_RESOLUTION' | 'BANKRUPTCY' | 'NEXT_PLAYER' | 'GAME_OVER';

export interface Debt {
  debtor: PlayerId;
  /** `null` = la banque / la cagnotte. */
  creditor: PlayerId | null;
  amount: number;
  toPot: boolean;
}

export type Pending =
  | { type: 'PROPERTY_DECISION'; player: PlayerId; tile: TileIndex; price: number }
  | { type: 'JAIL_CHOICE'; player: PlayerId }
  | { type: 'DEBT'; player: PlayerId; debt: Debt }
  | { type: 'TRADE'; offer: TradeOffer };

export interface TradeOffer {
  id: string;
  from: PlayerId;
  to: PlayerId;
  giveTiles: TileIndex[];
  giveCash: number;
  getTiles: TileIndex[];
  getCash: number;
}

export interface GameState {
  roomCode: string;
  phase: Phase;
  rng: number;
  /** Ordre de jeu figé au lancement. */
  order: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  tiles: Record<TileIndex, TileState>;
  currentIndex: number;
  /** Tour de table courant, 1-indexé. Les achats sont bloqués au tour 1. */
  round: number;
  doubles: number;
  lastRoll: [number, number] | null;
  pot: number;
  decks: Record<DeckId, string[]>;
  discard: Record<DeckId, string[]>;
  pending: Pending | null;
  /** Offres d'échange en attente de réponse. */
  trades: TradeOffer[];
  winner: PlayerId | null;
  version: number;
  startedAt: number;
}

/* ------------------------------------------------------------------ */
/* Commandes (intentions client → autorité)                            */
/* ------------------------------------------------------------------ */

export type Command =
  | { t: 'START_GAME'; by: PlayerId }
  | { t: 'ROLL_DICE'; by: PlayerId }
  | { t: 'BUY_PROPERTY'; by: PlayerId }
  | { t: 'DECLINE_PROPERTY'; by: PlayerId }
  | { t: 'BUILD'; by: PlayerId; tile: TileIndex }
  | { t: 'SELL_BUILDING'; by: PlayerId; tile: TileIndex }
  | { t: 'MORTGAGE'; by: PlayerId; tile: TileIndex }
  | { t: 'UNMORTGAGE'; by: PlayerId; tile: TileIndex }
  | { t: 'PAY_JAIL_FINE'; by: PlayerId }
  | { t: 'USE_JAIL_CARD'; by: PlayerId }
  | { t: 'ATTEMPT_JAIL_ROLL'; by: PlayerId }
  | { t: 'PROPOSE_TRADE'; by: PlayerId; offer: Omit<TradeOffer, 'id' | 'from'> }
  | { t: 'ACCEPT_TRADE'; by: PlayerId; id: string }
  | { t: 'DECLINE_TRADE'; by: PlayerId; id: string }
  | { t: 'SETTLE_DEBT'; by: PlayerId }
  | { t: 'DECLARE_BANKRUPTCY'; by: PlayerId }
  | { t: 'END_TURN'; by: PlayerId }
  | { t: 'SET_CONNECTED'; by: PlayerId; connected: boolean };

/* ------------------------------------------------------------------ */
/* Évènements (autorité → clients : la timeline à animer)              */
/* ------------------------------------------------------------------ */

export type GameEvent =
  | { e: 'GAME_STARTED'; order: PlayerId[] }
  | { e: 'TURN_STARTED'; player: PlayerId; round: number }
  | { e: 'DICE_ROLLED'; player: PlayerId; dice: [number, number]; isDouble: boolean; doublesStreak: number }
  | { e: 'THREE_DOUBLES'; player: PlayerId }
  | { e: 'MOVE_STEP'; player: PlayerId; from: TileIndex; to: TileIndex; step: number; total: number }
  | { e: 'PASSED_GO'; player: PlayerId; amount: number }
  | { e: 'EXACT_GO'; player: PlayerId; amount: number }
  | { e: 'LANDED'; player: PlayerId; tile: TileIndex }
  | { e: 'PROPERTY_OFFERED'; player: PlayerId; tile: TileIndex; price: number }
  | { e: 'PROPERTY_BOUGHT'; player: PlayerId; tile: TileIndex; price: number }
  | { e: 'PROPERTY_DECLINED'; player: PlayerId; tile: TileIndex }
  | { e: 'RENT_PAID'; from: PlayerId; to: PlayerId; amount: number; tile: TileIndex }
  | { e: 'TAX_PAID'; player: PlayerId; amount: number; tile: TileIndex }
  | { e: 'POT_CHANGED'; pot: number }
  | { e: 'POT_WON'; player: PlayerId; amount: number }
  | { e: 'CARD_DRAWN'; player: PlayerId; deck: DeckId; card: string }
  | { e: 'CASH_CHANGED'; player: PlayerId; delta: number; cash: number; reason: string }
  | { e: 'BUILT'; player: PlayerId; tile: TileIndex; level: BuildLevel; cost: number }
  | { e: 'BUILDING_SOLD'; player: PlayerId; tile: TileIndex; level: BuildLevel; refund: number }
  | { e: 'MORTGAGED'; player: PlayerId; tile: TileIndex; amount: number }
  | { e: 'UNMORTGAGED'; player: PlayerId; tile: TileIndex; amount: number }
  | { e: 'JAILED'; player: PlayerId; reason: 'doubles' | 'card' | 'tile' }
  | { e: 'JAIL_ATTEMPT'; player: PlayerId; attempt: number; dice: [number, number]; success: boolean }
  | { e: 'JAIL_RELEASED'; player: PlayerId; reason: 'double' | 'fine' | 'card' }
  | { e: 'TRADE_PROPOSED'; offer: TradeOffer }
  | { e: 'TRADE_ACCEPTED'; offer: TradeOffer }
  | { e: 'TRADE_DECLINED'; id: string }
  | { e: 'DEBT_OPENED'; debt: Debt }
  | { e: 'DEBT_SETTLED'; debtor: PlayerId }
  | { e: 'BANKRUPT'; player: PlayerId; creditor: PlayerId | null; tiles: TileIndex[] }
  | { e: 'GAME_OVER'; winner: PlayerId }
  | { e: 'PHASE'; phase: Phase };

export interface CommandResult {
  state: GameState;
  events: GameEvent[];
  /** Renseigné quand la commande est refusée : l'état est inchangé. */
  rejected?: string;
}
