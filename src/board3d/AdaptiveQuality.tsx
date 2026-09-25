import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Dégradation adaptative.
 *
 * Le nombre de cœurs est un mauvais indicateur : un portable de 2015 annonce
 * huit cœurs tout en embarquant un GPU intégré modeste. On mesure donc la
 * cadence réelle pendant les premières secondes et on allège la scène si
 * elle ne tient pas — ombres d'abord, puis résolution.
 */
export const AdaptiveQuality = ({ onDowngrade }: { onDowngrade?: () => void }) => {
  const { gl } = useThree();
  const frames = useRef(0);
  const elapsed = useRef(0);
  const steps = useRef(0);

  useFrame((_, dt) => {
    if (steps.current >= 2) return;
    // On ignore la toute première seconde : compilation des shaders et
    // téléversement des textures faussent la mesure.
    elapsed.current += dt;
    if (elapsed.current < 1) return;
    frames.current += 1;

    if (elapsed.current < 2.6) return;
    const fps = frames.current / (elapsed.current - 1);
    frames.current = 0;
    elapsed.current = 1;

    if (fps >= 48) {
      steps.current = 2; // cadence confortable : on ne touche à rien
      return;
    }

    steps.current += 1;
    if (steps.current === 1) {
      gl.shadowMap.enabled = false;
    } else {
      gl.setPixelRatio(Math.min(1, window.devicePixelRatio));
    }
    onDowngrade?.();
  });

  return null;
};
