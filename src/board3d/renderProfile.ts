/**
 * Profil de rendu, décidé UNE SEULE FOIS au chargement du module.
 *
 * Rien ici ne change ensuite. C'est délibéré : la version précédente mesurait
 * la cadence en cours de partie et abaissait la résolution quand elle jugeait
 * la machine trop lente. Sur téléphone, le seuil était franchi presque
 * systématiquement quelques secondes après le début — le tampon était
 * réalloué et la définition divisée en pleine action. C'est ce qui produisait
 * la perte de netteté et le clignotement.
 *
 * Un rendu stable un cran en dessous vaut mieux qu'un rendu qui se dégrade
 * sous les yeux du joueur.
 */

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

/**
 * Densité d'affichage, décidée par **budget de pixels** plutôt que par un
 * plafond fixe.
 *
 * La mesure est sans appel : à géométrie constante (5 200 triangles), passer
 * de 3,8 à 0,95 mégapixel fait bondir la cadence de 19 à 31 images/seconde.
 * Le coût est donc dans le remplissage, pas dans la scène. Un plafond fixe de
 * 2× impose 5 mégapixels sur un grand écran et étrangle les GPU intégrés,
 * alors qu'il n'en demande qu'un sur un téléphone.
 *
 * On vise donc une surface de rendu constante : la netteté suit la taille de
 * la fenêtre, et la cadence reste tenable partout. Calculé une fois, jamais
 * réévalué ensuite.
 */
const surfaceCss =
  typeof window !== 'undefined' ? Math.max(1, window.innerWidth * window.innerHeight) : 1e6;
/*
  Budget relevé de 2,4 à 6 mégapixels sur pointeur fin.

  L'ancien plafond était l'unique cause du manque de netteté, et elle se
  mesure : sur un écran de portable courant — 1 512 × 945 points, densité 2 —
  2,4 Mpx imposaient un rendu à 1,30×, soit **65 %** de la définition réelle
  de la dalle. En 1 920 × 1 080 on tombait à 1,08×, soit 54 %. Tout était
  donc dessiné à moitié de résolution puis agrandi : noms des cases, arêtes
  des pions, logo du tapis. Aucune densité de texture ne rattrape ça, puisque
  les textures sont déjà trois fois plus fines que ce que l'écran affiche.

  À 6 Mpx, une fenêtre jusqu'à ~1 550 × 970 points est rendue à la pleine
  densité de l'écran, et les plus grandes se dégradent progressivement au
  lieu d'être écrasées d'emblée.

  Le plafond matériel reste 2× : au-delà, on paierait du remplissage qu'aucun
  écran ne sait montrer. Le budget tactile ne change pas — un téléphone de
  375 × 812 atteignait déjà le plafond de 2×.
*/
const BUDGET_PIXELS = coarse ? 2_000_000 : 6_000_000;
export const RENDER_DPR = Math.max(
  1,
  Math.min(dpr, 2, Math.sqrt(BUDGET_PIXELS / surfaceCss)),
);

/**
 * Ombres portées. Mesurées à ~11 images/seconde de coût : on les garde sur
 * pointeur fin, mais avec une carte d'ombre deux fois plus petite — à cette
 * distance de caméra, la différence ne se voit pas.
 */
export const RENDER_SHADOWS: boolean = !(coarse || reduced);
export const SHADOW_MAP = 1024;

/**
 * Densité des textures peintes, en pixels par unité monde.
 *
 * Calibrée sur la taille réelle à l'écran : une case occupe au plus ~220
 * pixels d'appareil dans sa plus grande dimension. Peindre à 300 px par unité
 * produisait des textures six fois trop détaillées — soit près de 114 Mo de
 * mémoire graphique pour les quarante cases, sur des GPU qui la partagent avec
 * le système. 144 suffit largement depuis que les noms sont grands.
 */
export const TEXTURE_DPI = coarse ? 128 : 144;

/** Appareil tactile : sert aussi à alléger la géométrie décorative. */
export const IS_TOUCH = coarse;
export const REDUCED_MOTION = reduced;
