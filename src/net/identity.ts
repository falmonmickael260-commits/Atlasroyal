import { makePlayerId } from './protocol';

const PROFILE_KEY = 'fortune-city:profile';
const ID_KEY = 'fortune-city:id';
const ROOM_KEY = 'fortune-city:last-room';
const DEVICE_ROOM_KEY = 'fortune-city:device-room';
const ROOM_IDENTITIES_KEY = 'fortune-city:room-identities';

export interface Identity {
  id: string;
  name: string;
  avatar: string;
  color: string;
  token: string;
}

/** Tab identity stays separate; online guest seats can be restored from this browser's storage. */
const read = <T>(store: Storage | undefined, key: string): T | null => {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (store: Storage | undefined, key: string, value: unknown) => {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
};

export const loadIdentity = (): Identity => {
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
  const local = typeof localStorage !== 'undefined' ? localStorage : undefined;

  let id = read<string>(session, ID_KEY);
  if (!id) {
    const saved = read<RememberedRoom>(local, DEVICE_ROOM_KEY);
    id =
      saved && !saved.host && typeof saved.playerId === 'string' ? saved.playerId : makePlayerId();
    write(session, ID_KEY, id);
  }

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

export interface RememberedRoom {
  code: string;
  host: boolean;
  playerId?: string;
  /** Le transport doit être retrouvé à l'identique : un salon Supabase ne se
   *  rejoint pas en BroadcastChannel. */
  mode: 'local' | 'supabase' | 'server';
}

export const rememberRoom = (room: RememberedRoom) => {
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
  const saved = { ...room, playerId: read<string>(session, ID_KEY) ?? undefined };
  write(session, ROOM_KEY, saved);
  if (!room.host && room.mode !== 'local' && saved.playerId) {
    const local = typeof localStorage !== 'undefined' ? localStorage : undefined;
    const ids = read<Record<string, string>>(local, ROOM_IDENTITIES_KEY) ?? {};
    delete ids[room.code];
    ids[room.code] = saved.playerId;
    write(local, ROOM_IDENTITIES_KEY, Object.fromEntries(Object.entries(ids).slice(-20)));
  }
  if (!room.host && room.mode !== 'local')
    write(typeof localStorage !== 'undefined' ? localStorage : undefined, DEVICE_ROOM_KEY, saved);
};
export const restoreRoomIdentity = (code: string): string | null => {
  const local = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const id = read<Record<string, string>>(local, ROOM_IDENTITIES_KEY)?.[code];
  if (typeof id !== 'string' || !id) return null;
  write(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, ID_KEY, id);
  return id;
};

export const recallRoom = (): RememberedRoom | null =>
  read<RememberedRoom>(
    typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
    ROOM_KEY,
  ) ??
  read<RememberedRoom>(
    typeof localStorage !== 'undefined' ? localStorage : undefined,
    DEVICE_ROOM_KEY,
  );

export const forgetRoom = () => {
  try {
    sessionStorage?.removeItem(ROOM_KEY);
  } catch {}
  try {
    localStorage?.removeItem(DEVICE_ROOM_KEY);
  } catch {}
};
