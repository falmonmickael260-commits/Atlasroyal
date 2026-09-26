import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { setMaxAnisotropy, setTextureDensity } from './textures';
import { Board } from './Board';
import { Buildings } from './Buildings';
import { Tokens } from './Tokens';
import { Dice } from './Dice';
import { FixedCamera } from './FixedCamera';
import { Room } from './Room';
import { AdaptiveQuality } from './AdaptiveQuality';
import type { Cinema } from '../ui/cinema';
import type { GameState, PlayerId } from '../engine/types';

/**
 * Mesure du conteneur avant d'instancier le rendu.
 *
 * La mesure interne de `<Canvas>` peut rapporter 0×0 au montage (la feuille de
 * style du jeu n'est pas toujours appliquée quand l'observateur s'attache) :
 * le contexte WebGL est alors créé pour une surface vide et la scène n'est
 * jamais rendue, jusqu'à un redimensionnement. On attend donc une taille
 * réelle, et le conteneur porte ses dimensions en style en ligne pour ne
 * dépendre d'aucune CSS externe.
 */
const useReadySize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((s) =>
        Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1
          ? s
          : { w: r.width, h: r.height },
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    // Les rappels de ResizeObserver ne sont pas délivrés tant que le document
    // est masqué : un onglet ouvert en arrière-plan mesurerait 0×0 et n'en
    // sortirait jamais. Ces deux évènements-là, eux, arrivent.
    window.addEventListener('resize', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
      document.removeEventListener('visibilitychange', read);
    };
  }, []);
  return { ref, size };
};

/**
 * Accroche de développement : expose l'état R3F pour inspecter la scène et
 * forcer des images depuis la console (utile quand l'onglet est en arrière-plan
 * et que requestAnimationFrame est suspendu).
 */
const DevHandle = () => {
  const st = useThree();
  useEffect(() => {
    (window as unknown as { __r3f?: unknown }).__r3f = st;
  }, [st]);
  return null;
};

const Lights = () => (
  <>
    {/* Pièce éclairée : la lumière vient du plafond et rebondit sur la table,
        au lieu du contre-jour froid d'une scène flottant dans le vide. */}
    <hemisphereLight args={['#FFF3DC', '#4A3A2A', 1.15]} />
    <ambientLight intensity={0.85} color="#FFF6E6" />
    <directionalLight
      position={[12, 26, 14]}
      intensity={2.6}
      color="#FFF4DE"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-bias={-0.0006}
    />
    {/* Lumière d'appoint, côté opposé : adoucit les ombres sans les effacer. */}
    <directionalLight position={[-16, 14, -12]} intensity={0.9} color="#CFE0FF" />
    {/* Suspension au-dessus de la table : le halo chaud qui centre le regard. */}
    <pointLight position={[0, 13, 2]} intensity={90} distance={46} decay={1.6} color="#FFE2A8" />
  </>
);

/**
 * La densité doit être fixée avant que le moindre `useMemo` de texture ne
 * s'exécute : on la règle au chargement du module, pas dans un effet.
 */
/** Densité d'affichage plafonnée : au-delà de 2, le coût dépasse le gain. */
const MAX_DPR = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);

setTextureDensity(
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 160 : 256,
);

export const Scene = ({
  state,
  cinema,
  compact,
  activePlayer,
  quality,
  onContextLost,
  labels,
}: {
  state: GameState;
  cinema: Cinema;
  compact: boolean;
  activePlayer: PlayerId | null;
  quality: 'high' | 'low';
  onContextLost?: () => void;
  /** Étiquettes DOM des prénoms, positionnées par la scène. */
  labels: React.RefObject<Map<PlayerId, HTMLElement | null>>;
}) => {
    const fog = useMemo(() => new THREE.FogExp2('#241B14', 0.006), []);
  const { ref, size } = useReadySize();
  // Les dés roulent au centre du plateau, comme sur une vraie table : un
  // emplacement fixe, toujours dégagé, que toute la tablée regarde.
  const diceAt = useMemo<[number, number, number]>(() => [0, 0, 4.2], []);
  const ready = size.w > 0 && size.h > 0;

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#050A14' }}>
      {ready && (
        <Canvas
          shadows={quality === 'high' ? 'soft' : false}
          // On suit la densité réelle de l'écran : c'est ce qui sépare un
          // rendu net d'un rendu qui « bave » sur un affichage haute densité.
          dpr={quality === 'high' ? [1, MAX_DPR] : [1, 1.25]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
          }}
          camera={{
            position: [0, 28, 26],
            fov: compact ? 52 : 34,
            near: 0.5,
            far: 220,
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: size.w,
            height: size.h,
          }}
          onCreated={({ gl }) => {
        // L'anisotropie maximale du contexte : indispensable pour des cases
        // lisibles quand le plateau est vu de biais.
        setMaxAnisotropy(gl.capabilities.getMaxAnisotropy());
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
            // Une perte de contexte WebGL (veille, bascule de GPU, onglets multiples)
            // est récupérable : sans preventDefault le navigateur ne le restaure pas.
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              onContextLost?.();
            });
          }}
        >
          <color attach="background" args={['#1C1611']} />
          <primitive attach="fog" object={fog} />
          {import.meta.env.DEV && <DevHandle />}
          <AdaptiveQuality />
          <Lights />
          <Suspense fallback={null}>
            <Board state={state} highlight={cinema.highlight} purchase={cinema.purchase} />
            <Buildings state={state} />
            <Tokens
              state={state}
              tokenTile={cinema.tokenTile}
              activePlayer={activePlayer}
              labels={labels}
            />
            <Dice dice={cinema.dice} at={diceAt} />
          </Suspense>
          <Room full />
          <FixedCamera compact={compact} />
        </Canvas>
      )}
    </div>
  );
};
