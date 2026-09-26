import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO } from './layout';

/**
 * Caméra strictement immobile.
 *
 * Elle est posée une fois devant la table et n'en bouge plus : pas de suivi
 * de pion, pas de zoom automatique, pas de dérive au repos. Seuls les objets
 * du jeu s'animent — c'est ce qui donne la sensation d'un plateau réel posé
 * devant soi plutôt que d'une séquence de jeu vidéo.
 *
 * La seule chose recalculée est le cadrage, et uniquement quand la fenêtre
 * change de taille : la distance est déduite du champ de vision et du rapport
 * d'image pour que le plateau tienne entier, du 16/9 au portrait étroit.
 */
export const FixedCamera = ({ compact }: { compact: boolean }) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.aspect = size.width / Math.max(1, size.height);
    cam.fov = compact ? 46 : 32;
    cam.near = 0.5;
    cam.far = 400;

    // Inclinaison de la vue : assez haute pour lire les cases du fond, assez
    // basse pour que le relief des bâtiments se voie.
    const tilt = compact ? 0.98 : 0.88;
    const aimY = compact ? 0 : -1.2;

    // Coins du plateau, sommets des constructions compris : ce sont eux qui
    // doivent tenir à l'image.
    const h = GEO.half;
    const coins: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        coins.push(new THREE.Vector3(sx * h, 0, sz * h));
        coins.push(new THREE.Vector3(sx * h, 1.8, sz * h));
      }
    }

    /**
     * Cadrage par mesure, non par estimation.
     *
     * Un plateau vu de biais se projette de façon asymétrique : son bord
     * proche paraît nettement plus large que son bord lointain. Une formule
     * fondée sur la seule distance au centre le coupe donc sur les côtés.
     * On projette les coins, on mesure le débordement réel, et on recule
     * d'autant — trois passes suffisent à converger.
     */
    const place = (dist: number) => {
      cam.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist);
      cam.lookAt(0, aimY, 0);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
    };

    // Part de l'écran réellement disponible pour le plateau : le rail des
    // joueurs occupe le haut et la barre d'action le bas, davantage en
    // compact où tout est empilé.
    // En portrait c'est la largeur qui contraint : on la sollicite presque
    // entièrement, sinon le plateau paraît perdu au milieu de la table.
    const utileX = compact ? 0.985 : 0.92;
    const utileY = compact ? 0.72 : 0.86;

    let dist = h * 3;
    for (let i = 0; i < 5; i++) {
      place(dist);
      let debord = 0;
      for (const p of coins) {
        const ndc = p.clone().project(cam);
        debord = Math.max(debord, Math.abs(ndc.x) / utileX, Math.abs(ndc.y) / utileY);
      }
      if (Math.abs(debord - 1) < 0.005) break;
      dist *= debord;
    }
    place(dist);
  }, [camera, size.width, size.height, compact]);

  return null;
};
