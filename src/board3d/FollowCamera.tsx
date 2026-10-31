import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, PLACEMENTS } from './layout';
import { REDUCED_MOTION } from './renderProfile';

/**
 * Caméra de la table.
 *
 * Vue stratégique au repos, cadrée sur tout le plateau. Le lancer, le trajet
 * et l'arrivée déclenchent chacun un cadrage cinématique distinct, puis la
 * caméra revient automatiquement à la vue d'ensemble. Le joueur peut aussi
 * verrouiller cette vue avec le bouton de caméra.
 *
 * Les changements de cible, d'angle et de distance sont amortis au delta-temps
 * pour éviter les à-coups sur ordinateur comme sur mobile.
 *
 * Le cadrage de repos est **mesuré**, pas estimé : on projette les coins du
 * plateau et on recule jusqu'à ce qu'ils tiennent tous. Un plateau vu de
 * biais projette son bord proche plus large que son bord lointain, si bien
 * qu'une formule fondée sur la distance au centre le coupe sur les côtés.
 */
export const FollowCamera = ({
  compact,
  follow,
  landing,
  rolling,
  overview,
}: {
  compact: boolean;
  /** Case actuellement suivie, ou `null` pour la vue d'ensemble. */
  follow: number | null;
  landing: number | null;
  rolling: boolean;
  overview: boolean;
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

    /*
      Inclinaison : angle de la caméra au-dessus du plan de la table.

      À 0,88 rad (50°) la vue était trop rasante. La perspective écrasait la
      rangée du fond : ses cases faisaient 32 px de haut à l'écran contre 55
      pour la rangée proche, et leurs noms devenaient illisibles alors que
      ceux du bas se lisaient très bien. Plus près de la verticale, les quatre
      rangées se projettent à des tailles comparables et le plateau se lit
      d'un bloc, sans rien perdre du relief des bâtiments.
    */
    const tilt = compact ? 1.17 : 1.12;
    const aimY = compact ? 0 : -1.2;

    // Le cadre et le socle débordent de l'illustration d'environ 0,5 unité.
    // Les inclure évite que le bord métallique soit coupé sur téléphone.
    const h = GEO.half + 0.55;
    const coins: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        coins.push(new THREE.Vector3(sx * h, 0, sz * h));
        coins.push(new THREE.Vector3(sx * h, 1.8, sz * h));
      }
    }

    // Part de l'écran réellement disponible : le rail des joueurs occupe le
    // haut et la barre d'action le bas, davantage en compact.
    const utileX = compact ? 0.88 : 0.92;
    const utileY = compact ? 0.76 : 0.86;

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
    const mode = overview || REDUCED_MOTION
      ? 'overview'
      : rolling
        ? 'dice'
        : follow !== null
          ? 'move'
          : landing !== null
            ? 'landing'
            : 'overview';
    const tile = mode === 'move' ? follow : mode === 'landing' ? landing : null;
    const p = tile === null ? null : PLACEMENTS[tile];

    // Chaque étape a sa propre mise en scène : lancer au centre, déplacement
    // accompagné, arrêt lisible sur la case, puis retour au cadrage complet.
    if (mode === 'dice') {
      cible.set(0, 0.3, 3.8);
    } else if (p) {
      const focusScale = compact ? 0.18 : mode === 'landing' ? 0.42 : 0.3;
      cible.set(p.pos[0] * focusScale, 0, p.pos[2] * focusScale);
    } else {
      cible.set(0, repos.aimY, 0);
    }

    const distFactor = mode === 'dice'
      ? compact ? 0.96 : 0.82
      : mode === 'move'
        ? compact ? 0.97 : 0.88
        : mode === 'landing'
          ? compact ? 0.94 : 0.78
          : 1;
    const dist = repos.dist * distFactor;
    const tilt = mode === 'landing' && !compact ? Math.max(0.98, repos.tilt - 0.12) : repos.tilt;

    // La caméra vient du côté du bord actif pendant les déplacements. Elle
    // conserve une vue large, mais donne au déplacement une vraie perspective.
    const azimuth = p && mode !== 'landing'
      ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][p.side]
      : 0;
    const horizontal = Math.cos(tilt) * dist;
    desiree.set(
      cible.x + Math.sin(azimuth) * horizontal,
      cible.y + Math.sin(tilt) * dist,
      cible.z + Math.cos(azimuth) * horizontal,
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
