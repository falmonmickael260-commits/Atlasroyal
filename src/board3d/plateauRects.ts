/**
 * Emplacements des pastilles de propriétaire sur l'illustration du plateau.
 *
 * Relevés par détection sur le fichier source, puis remplis à la couleur du
 * carton pour que les cases non vendues n'affichent rien. On y repose la
 * couleur du joueur quand la ville lui appartient.
 *
 * Ils sont **propres à ce fichier** : d'une version de l'illustration à
 * l'autre, les rectangles se décalent de quelques pixels. Toute nouvelle
 * image demande donc de relancer la détection plutôt que de réutiliser ces
 * valeurs.
 *
 * Le dessin n'en comporte pas pour le Réseau Solaire, qui est pourtant une
 * case achetable ; le sien est interpolé entre ses deux voisins de colonne.
 */
export const PLATEAU_PX = 1254;

/** case -> [x, y, largeur, hauteur] en pixels de l'image source. */
export const PASTILLES: Record<number, [number, number, number, number]> = {
  1: [966, 1056, 66, 26],
  2: [874, 1058, 64, 24],
  3: [780, 1056, 66, 26],
  4: [686, 1056, 66, 26],
  5: [588, 1058, 68, 24],
  6: [494, 1058, 64, 24],
  7: [406, 1056, 62, 26],
  8: [316, 1058, 66, 24],
  9: [224, 1058, 66, 24],
  11: [30, 954, 66, 24],
  12: [30, 862, 66, 24],
  13: [30, 770, 66, 26],
  14: [30, 672, 66, 24],
  15: [30, 566, 66, 24],
  16: [30, 470, 66, 24],
  18: [30, 292, 68, 24],
  19: [30, 198, 66, 24],
  21: [222, 16, 70, 28],
  22: [314, 16, 68, 28],
  23: [404, 16, 70, 28],
  24: [496, 16, 70, 28],
  25: [588, 18, 80, 26],
  26: [692, 16, 70, 28],
  27: [786, 18, 68, 26],
  28: [876, 18, 68, 26],
  29: [966, 18, 70, 26],
  31: [1062, 198, 70, 24],
  32: [1062, 292, 70, 24],
  34: [1062, 470, 70, 24],
  35: [1062, 566, 70, 24],
  36: [1062, 672, 70, 24],
  37: [1062, 772, 70, 24],
  39: [1062, 954, 70, 24],
};
