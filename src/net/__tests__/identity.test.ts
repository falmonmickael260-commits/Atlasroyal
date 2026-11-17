import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import {
  loadIdentity,
  rememberRoom,
  recallRoom,
  forgetRoom,
  restoreRoomIdentity,
} from '../identity';
class Storage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
beforeEach(() => {
  vi.stubGlobal('sessionStorage', new Storage());
  vi.stubGlobal('localStorage', new Storage());
});
afterEach(() => vi.unstubAllGlobals());
it('retrouve le joueur et le salon après fermeture de l’onglet', () => {
  const old = loadIdentity();
  rememberRoom({ code: 'ABCDE', host: false, mode: 'server' });
  vi.stubGlobal('sessionStorage', new Storage());
  expect(loadIdentity().id).toBe(old.id);
  expect(recallRoom()?.code).toBe('ABCDE');
});
it('conserve l’identité d’un onglet déjà ouvert', () => {
  const old = loadIdentity();
  rememberRoom({ code: 'ABCDE', host: false, mode: 'server' });
  sessionStorage.setItem('fortune-city:id', JSON.stringify('other-tab'));
  expect(loadIdentity().id).toBe('other-tab');
  expect(old.id).not.toBe('other-tab');
});
it('efface le lien quand le salon est définitivement fermé', () => {
  loadIdentity();
  rememberRoom({ code: 'ABCDE', host: false, mode: 'server' });
  forgetRoom();
  vi.stubGlobal('sessionStorage', new Storage());
  expect(recallRoom()).toBeNull();
});
it('ne fusionne pas les joueurs du mode local dans plusieurs onglets', () => {
  const old = loadIdentity();
  rememberRoom({ code: 'ABCDE', host: false, mode: 'local' });
  vi.stubGlobal('sessionStorage', new Storage());
  expect(loadIdentity().id).not.toBe(old.id);
  expect(recallRoom()).toBeNull();
});

it('retrouve la place par code même si le lien de reprise a été effacé', () => {
  const original = loadIdentity();
  rememberRoom({ code: 'ABCDE', host: false, mode: 'server' });
  forgetRoom();
  vi.stubGlobal('sessionStorage', new Storage());
  loadIdentity();
  expect(restoreRoomIdentity('ABCDE')).toBe(original.id);
  expect(loadIdentity().id).toBe(original.id);
});
