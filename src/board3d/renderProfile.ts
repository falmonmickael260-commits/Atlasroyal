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
const BUDGET_PIXELS = coarse ? 2_000_000 : 2_400_000;
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
