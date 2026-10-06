import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Carte d'environnement des pièces métalliques.
 *
 * Un métal n'a presque pas de couleur propre : ce qu'on voit de lui est le
 * reflet de ce qui l'entoure, teinté. Sans environnement, un matériau à forte
 * `metalness` est donc quasiment noir, et c'est pour cela que les pions ne
 * pouvaient pas « faire métal » quelle que soit la lumière ajoutée.
 *
 * On charge donc une vraie sonde de studio photo — 512 × 256, domaine public
 * (Poly Haven, CC0) — qu'on convoque en carte d'irradiance filtrée. Les
 * sources larges du studio deviennent les reflets allongés qui courent sur
 * les arêtes : c'est précisément ce qui fait lire « pièce moulée » plutôt que
 * « volume coloré ».
 *
 * Deux garde-fous :
 *
 * - l'attente est plafonnée. Si la sonde tarde ou manque, on se rabat sur une
 *   pièce procédurale fournie avec three. Le rendu est moins riche, mais le
 *   plateau ne reste jamais bloqué sur un écran vide à cause d'un fichier ;
 * - elle n'est **pas** posée sur la scène entière. Mesuré et écarté :
 *   appliquée globalement elle éclaire aussi le bois et la feutrine, et le
 *   plateau se délave. Seuls les matériaux qui ont un reflet à montrer y sont
 *   branchés.
 */
const SONDE = `${import.meta.env.BASE_URL}env/atelier.hdr`;

let donnees: THREE.DataTexture | null = null;
let attente: Promise<void> | null = null;
let cache: THREE.Texture | null = null;

/** À appeler avant le montage de la scène : le décodage ne demande pas de GPU. */
export const prechargerEnvironnement = (): Promise<void> => {
  if (attente) return attente;
  attente = new Promise<void>((resolve) => {
    let fini = false;
    const terminer = () => { if (!fini) { fini = true; resolve(); } };
    // Au-delà de trois secondes, on joue sans la sonde plutôt que de faire
    // patienter devant un écran vide.
    const minuteur = setTimeout(terminer, 3000);
    new RGBELoader().load(
      SONDE,
      (texture) => { donnees = texture; clearTimeout(minuteur); terminer(); },
      undefined,
      () => { clearTimeout(minuteur); terminer(); },
    );
  });
  return attente;
};

/** Carte d'irradiance partagée. Produite une seule fois pour toute la page. */
export const envMapPartagee = (gl: THREE.WebGLRenderer): THREE.Texture => {
  if (cache) return cache;
  const pmrem = new THREE.PMREMGenerator(gl);
  let cible: THREE.WebGLRenderTarget;
  if (donnees) {
    cible = pmrem.fromEquirectangular(donnees);
    donnees.dispose();
    donnees = null;
  } else {
    const piece = new RoomEnvironment();
    cible = pmrem.fromScene(piece, 0.04);
    piece.dispose();
  }
  pmrem.dispose();
  cache = cible.texture;
  return cache;
};

/** Vrai si la sonde de studio a bien été utilisée (diagnostic). */
export const sondeChargee = () => cache !== null && donnees === null;
