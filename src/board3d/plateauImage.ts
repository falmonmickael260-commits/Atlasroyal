import * as THREE from 'three';

/**
 * Illustration du plateau.
 *
 * Elle remplace les quarante faces peintes au Canvas : une seule image couvre
 * toute la surface, cadre et tapis central compris. Comme pour les polices et
 * le logo, elle doit être décodée **avant** le montage de la scène — un
 * plateau monté sans sa texture resterait gris pour toute la partie.
 */
const SOURCE = `${import.meta.env.BASE_URL}plateau/plateau.webp`;

let texture: THREE.Texture | null = null;
let attente: Promise<void> | null = null;

export const prechargerPlateau = (): Promise<void> => {
  if (attente) return attente;
  attente = new Promise<void>((resolve) => {
    let fini = false;
    const terminer = () => { if (!fini) { fini = true; resolve(); } };
    // Au-delà de cinq secondes on monte sans elle : mieux vaut un plateau nu
    // qu'un écran de chargement sans fin.
    const minuteur = setTimeout(terminer, 5000);
    new THREE.TextureLoader().load(
      SOURCE,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        texture = t;
        clearTimeout(minuteur);
        terminer();
      },
      undefined,
      () => { clearTimeout(minuteur); terminer(); },
    );
  });
  return attente;
};

export const texturePlateau = (): THREE.Texture | null => texture;
