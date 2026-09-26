import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, PLACEMENTS } from './layout';
import { REDUCED_MOTION } from './renderProfile';

/**
 * Caméra de la table.
 *
 * Au repos elle est **strictement immobile** : aucune dérive, aucun zoom.
 * Elle ne s'anime que pendant le déplacement d'un pion, pour permettre de
 * suivre le trajet et de voir la case d'arrivée, puis revient d'elle-même à
 * la vue d'ensemble.
 *
 * Le mouvement est un amortissement exponentiel cadré sur le delta-temps :
 * jamais de saut, jamais de rotation, pas de changement d'inclinaison. Seuls
 * le point visé et la distance varient, ce qui évite l'effet de tangage.
 *
 * Le cadrage de repos est **mesuré**, pas estimé : on projette les coins du
 * plateau et on recule jusqu'à ce qu'ils tiennent tous. Un plateau vu de
 * biais projette son bord proche plus large que son bord lointain, si bien
 * qu'une formule fondée sur la distance au centre le coupe sur les côtés.
 */
export const FollowCamera = ({
  compact,
  follow,
}: {
  compact: boolean;
  /** Case actuellement suivie, ou `null` pour la vue d'ensemble. */
  follow: number | null;
}) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const vise = useRef(new THREE.Vector3(0, 0, 0));
  const posCourante = useRef(new THREE.Vector3());
  const initialise = useRef(false);

  const desiree = useMemo(() => new THREE.Vector3(), []);
  const cible = useMemo(() => new THREE.Vector3(), []);

  /** Cadrage de repos : distance, inclinaison et point visé. */
  const repos = useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    cam.aspect = aspect;
    cam.fov = compact ? 46 : 32;
    /*
      Plage de profondeur resserrée sur ce que la scène occupe réellement.
      La précision du tampon de profondeur se répartit sur le rapport
      lointain/proche : à 0,5 / 400 elle valait 800, et les surfaces voisines
      devenaient indiscernables. À 5 / 200 le rapport tombe à 40, soit vingt
      fois plus de précision là où les objets se touchent.
      Rien n'est plus près que ~15 unités de la caméra, ni plus loin que ~120.
    */
    cam.near = 5;
    cam.far = 200;

    const tilt = compact ? 0.98 : 0.88;
    const aimY = compact ? 0 : -1.2;

    const h = GEO.half;
    const coins: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        coins.push(new THREE.Vector3(sx * h, 0, sz * h));
        coins.push(new THREE.Vector3(sx * h, 1.8, sz * h));
      }
    }

    // Part de l'écran réellement disponible : le rail des joueurs occupe le
    // haut et la barre d'action le bas, davantage en compact.
    const utileX = compact ? 0.985 : 0.92;
    const utileY = compact ? 0.72 : 0.86;

    const sonde = new THREE.PerspectiveCamera(cam.fov, aspect, cam.near, cam.far);
    let dist = h * 3;
    for (let i = 0; i < 5; i++) {
      sonde.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist);
      sonde.lookAt(0, aimY, 0);
      sonde.updateMatrixWorld();
      sonde.updateProjectionMatrix();
      let debord = 0;
      for (const p of coins) {
        const ndc = p.clone().project(sonde);
        debord = Math.max(debord, Math.abs(ndc.x) / utileX, Math.abs(ndc.y) / utileY);
      }
      if (Math.abs(debord - 1) < 0.005) break;
      dist *= debord;
    }

    cam.updateProjectionMatrix();
    return { dist, tilt, aimY };
  }, [camera, size.width, size.height, compact]);

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;

    // Point visé : centre du plateau au repos, case suivie pendant un trajet.
    if (follow !== null && !REDUCED_MOTION) {
      const p = PLACEMENTS[follow].pos;
      // On ne se déporte qu'à moitié vers la case : le plateau reste dans le
      // champ et le joueur ne perd jamais ses repères.
      cible.set(p[0] * 0.5, repos.aimY, p[2] * 0.5);
    } else {
      cible.set(0, repos.aimY, 0);
    }

    // Approche : un peu plus près pendant le suivi, pour lire la case.
    const dist = follow !== null && !REDUCED_MOTION ? repos.dist * 0.82 : repos.dist;

    desiree.set(
      cible.x,
      Math.sin(repos.tilt) * dist,
      cible.z + Math.cos(repos.tilt) * dist,
    );

    if (!initialise.current) {
      // Première image : on se place directement, sans glissement visible.
      posCourante.current.copy(desiree);
      vise.current.copy(cible);
      initialise.current = true;
    } else {
      // Amortissement doux, indépendant de la cadence d'affichage.
      const k = 1 - Math.pow(0.035, dt);
      posCourante.current.lerp(desiree, k);
      vise.current.lerp(cible, k);
    }

    cam.position.copy(posCourante.current);
    cam.lookAt(vise.current);
  });

  return null;
};
