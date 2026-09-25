import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Board } from './Board';
import { Buildings } from './Buildings';
import { Tokens } from './Tokens';
import { Dice } from './Dice';
import { CityLife } from './CityLife';
import { CameraRig } from './CameraRig';
import { GEO, inwardOf } from './layout';
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
    return () => ro.disconnect();
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
    <hemisphereLight args={['#BFDBFE', '#052e1a', 0.7]} />
    <ambientLight intensity={0.42} />
    <directionalLight
      position={[14, 22, 12]}
      intensity={2.7}
      color="#FFF7E0"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
      shadow-bias={-0.0006}
    />
    {/* Contre-jour froid : détache le plateau du fond. */}
    <directionalLight position={[-16, 10, -14]} intensity={0.8} color="#60A5FA" />
    <pointLight position={[0, 9, 0]} intensity={26} distance={34} color="#EAB308" />
  </>
);

export const Scene = ({
  state,
  cinema,
  compact,
  activePlayer,
  quality,
  onContextLost,
}: {
  state: GameState;
  cinema: Cinema;
  compact: boolean;
  activePlayer: PlayerId | null;
  quality: 'high' | 'low';
  onContextLost?: () => void;
}) => {
  const fog = useMemo(() => new THREE.FogExp2('#050A14', 0.0125), []);
  const { ref, size } = useReadySize();
  // Les dés tombent près du pion qui joue : la caméra y est déjà.
  const diceAt = useMemo(
    () =>
      inwardOf(
        activePlayer ? (cinema.tokenTile[activePlayer] ?? state.players[activePlayer].position) : 0,
        3.1,
      ),
    [activePlayer, cinema.tokenTile, state.players],
  );
  const ready = size.w > 0 && size.h > 0;

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#050A14' }}>
      {ready && (
        <Canvas
          shadows={quality === 'high'}
          dpr={quality === 'high' ? [1, 1.8] : [1, 1.2]}
          gl={{
            antialias: quality === 'high',
            powerPreference: 'high-performance',
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
            // Une perte de contexte WebGL (veille, bascule de GPU, onglets multiples)
            // est récupérable : sans preventDefault le navigateur ne le restaure pas.
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              onContextLost?.();
            });
          }}
        >
          <color attach="background" args={['#050A14']} />
          <primitive attach="fog" object={fog} />
          {import.meta.env.DEV && <DevHandle />}
          <Lights />
          <Suspense fallback={null}>
            <Board state={state} highlight={cinema.highlight} />
            <Buildings state={state} />
            <Tokens state={state} tokenTile={cinema.tokenTile} activePlayer={activePlayer} />
            <Dice dice={cinema.dice} at={diceAt} />
            <CityLife quality={quality} />
          </Suspense>
          {/* Sol de réflexion : le plateau flotte au-dessus d'une mer sombre. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
            <circleGeometry args={[GEO.side * 2.4, 64]} />
            <meshStandardMaterial color="#04070E" roughness={0.35} metalness={0.85} />
          </mesh>
          <CameraRig focus={cinema.focus} compact={compact} playing={cinema.playing} />
        </Canvas>
      )}
    </div>
  );
};
