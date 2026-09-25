/**
 * Correspondance entre la valeur d'un dé et l'orientation qui la présente
 * vers le haut.
 *
 * Isolé du composant pour être vérifiable : un dé qui n'affiche pas le
 * chiffre tiré est un bug silencieux, invisible au typage et facile à
 * introduire en se trompant de signe de rotation.
 */

/** Ordre des matériaux d'une BoxGeometry : +x, -x, +y, -y, +z, -z. */
export const FACE_ORDER = [1, 6, 2, 5, 3, 4] as const;

/** Rotation amenant la valeur demandée face au ciel. */
export const restFor = (value: number): [number, number, number] => {
  switch (value) {
    case 1: return [0, 0, Math.PI / 2];   // +x vers le haut
    case 6: return [0, 0, -Math.PI / 2];  // -x vers le haut
    case 2: return [0, 0, 0];             // +y : déjà en haut
    case 5: return [Math.PI, 0, 0];       // -y vers le haut
    case 3: return [-Math.PI / 2, 0, 0];  // +z vers le haut
    default: return [Math.PI / 2, 0, 0];  // -z vers le haut (4)
  }
};
