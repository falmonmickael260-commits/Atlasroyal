import { makePlayerId } from './protocol';

const PROFILE_KEY = 'atlas-royale:profile';
const ID_KEY = 'atlas-royale:id';
const ROOM_KEY = 'atlas-royale:last-room';

export interface Identity {
  id: string;
  name: string;
  avatar: string;
  color: string;
  token: string;
}

/**
 * L'identifiant vit dans `sessionStorage` : il est propre à l'onglet, ce qui
 * permet d'ouvrir plusieurs joueurs sur une même machine, tout en survivant
 * à un rafraîchissement (c'est le cas de reconnexion à couvrir).
 * Le profil (pseudo, avatar…) vit dans `localStorage` : on ne le retape pas
 * d'une session à l'autre.
 */
const read = <T>(store: Storage | undefined, key: string): T | null => {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
};

const write = (store: Storage | undefined, key: string, value: unknown) => {
  try { store?.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
};

export const loadIdentity = (): Identity => {
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
  const local = typeof localStorage !== 'undefined' ? localStorage : undefined;

  let id = read<string>(session, ID_KEY);
  if (!id) { id = makePlayerId(); write(session, ID_KEY, id); }

  const profile = read<Partial<Identity>>(local, PROFILE_KEY) ?? {};
  return {
    id,
    name: profile.name ?? '',
    avatar: profile.avatar ?? 'a1',
    color: profile.color ?? '#F5D97B',
    token: profile.token ?? 't1',
  };
};

export const saveIdentity = ({ id: _id, ...profile }: Identity) => {
  write(typeof localStorage !== 'undefined' ? localStorage : undefined, PROFILE_KEY, profile);
};

export const rememberRoom = (code: string, host: boolean) =>
  write(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, ROOM_KEY, { code, host });

export const recallRoom = (): { code: string; host: boolean } | null =>
  read(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, ROOM_KEY);
