/**
 * Drapeau « générique déjà vu », isolé dans son propre module : `App` peut le
 * lire sans importer le lecteur Remotion, qui reste chargé à la demande.
 */
export const SEEN_KEY = 'atlas-royale:intro-seen';

export const introAlreadySeen = (): boolean => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
};
