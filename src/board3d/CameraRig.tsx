import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO } from './layout';

export interface Focus {
  at: [number, number, number];
  zoom: number;
  key: number;
}

/**
 * Caméra dynamique.
 *
 * La distance n'est pas une constante : elle est **calculée** à partir du champ
 * de vision et du rapport d'image pour que le plateau tienne toujours à
 * l'écran — c'est ce qui fait tenir la vue aussi bien en 16/9 sur ordinateur
 * qu'en portrait étroit sur téléphone.
 *
 * Position et visée sont ensuite interpolées image par image (lerp cadré sur
 * le delta-temps, règle three.js « Lerp for Smooth Follow ») : la caméra ne
 * saute jamais. Au repos, une dérive orbitale lente évite l'image figée.
 */
export const CameraRig = ({
  focus,
  compact,
  playing,
}: {
  focus: Focus;
  compact: boolean;
  playing: boolean;
}) => {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const drift = useRef(0);

  /** Inclinaison de la vue au-dessus de l'horizon, en radians. */
  const tilt = compact ? 1.02 : 0.9;

  const frame = useMemo(
    () => (at: [number, number, number], zoom: number, sway: number, roll: number) => {
      const cam = camera as THREE.PerspectiveCamera;
      const vFov = (cam.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (cam.aspect || 1));

      // Demi-encombrement du plateau tel qu'il se projette à l'écran.
      const halfW = GEO.half * 1.06;
      const halfH = GEO.half * Math.cos(tilt) + 3;
      // Marge plus serrée en portrait : l'écran est déjà étroit, le plateau
      // doit y occuper la place disponible.
      const margin = compact ? 1.12 : 1.18;
      const dist =
        (Math.max(halfW / Math.tan(hFov / 2), halfH / Math.tan(vFov / 2)) * margin) /
        Math.pow(zoom, 0.85);

      // En vue d'ensemble la caméra reste centrée ; elle ne se déporte vers la
      // case visée qu'à mesure qu'elle zoome.
      const pull = Math.min(0.78, 0.1 + (zoom - 1) * 0.6);
      return {
        pos: [
          at[0] * pull + sway,
          Math.sin(tilt) * dist,
          at[2] * pull + Math.cos(tilt) * dist + Math.cos(roll) * 0.7,
        ] as const,
        // Viser sous le plateau le remonte dans l'image et dégage la barre
        // d'action ; en portrait cette barre est déjà hors du champ.
        look: [at[0] * (pull + 0.18), compact ? -0.4 : -2, at[2] * (pull + 0.18)] as const,
      };
    },
    [camera, tilt, compact],
  );

  // Le plateau doit être correctement cadré dès la toute première image : sans
  // cela, un onglet qui n'a pas encore d'animation (arrière-plan, veille)
  // afficherait une caméra orientée vers le vide.
  useLayoutEffect(() => {
    const f = frame(focus.at, focus.zoom, 0, 0);
    camera.position.set(...f.pos);
    look.current.set(...f.look);
    camera.lookAt(look.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, frame]);

  useFrame((_, dt) => {
    drift.current += dt * (playing ? 0.02 : 0.055);
    // L'amplitude de dérive est réduite en portrait : quelques unités y
    // représentent une part bien plus grande de la largeur visible.
    const sway = Math.sin(drift.current) * (compact ? 0.4 : playing ? 0.5 : 1.2);
    const f = frame(focus.at, focus.zoom, sway, drift.current);
    desired.set(...f.pos);
    lookTarget.set(...f.look);

    const k = 1 - Math.pow(0.0025, dt);
    camera.position.lerp(desired, k);
    look.current.lerp(lookTarget, k);
    camera.lookAt(look.current);
  });

  return null;
};
