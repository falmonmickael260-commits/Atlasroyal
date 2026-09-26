import { Suspense, memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Board } from './Board';
import { Buildings } from './Buildings';
import { Tokens } from './Tokens';
import { Dice } from './Dice';
import { FollowCamera } from './FollowCamera';
import { Room } from './Room';
import { fontsReady } from './fonts';
import { RENDER_DPR, RENDER_SHADOWS, SHADOW_MAP, TEXTURE_DPI } from './renderProfile';
import { setMaxAnisotropy, setTextureDensity } from './textures';
import type { Cinema } from '../ui/cinema';
import type { GameState, PlayerId } from '../engine/types';

/* La densité doit être fixée avant la création de la moindre texture. */
setTextureDensity(TEXTURE_DPI);

/**
 * Props du Canvas, figées au niveau du module.
 *
 * Elles ne doivent JAMAIS changer d'identité : R3F compare `dpr` et `camera`
 * par référence et réapplique la taille du tampon à chaque changement. Des
 * littéraux écrits dans le JSX en créaient de nouveaux à chaque rendu — donc
 * un redimensionnement à chaque pas de pion, visible sous forme de
 * clignotement. C'est la cause principale du défaut observé sur téléphone.
 */
const GL_PROPS = {
  antialias: true,
  powerPreference: 'high-performance' as const,
  alpha: false,
  stencil: false,
};
const CANVAS_STYLE = { position: 'absolute', inset: 0 } as const;

/**
 * Accroche de développement : expose l'état R3F pour inspecter la scène et
 * mesurer la caméra depuis la console. Absente du build de production.
 */
const DevHandle = () => {
  const st = useThree();
  useEffect(() => {
    (window as unknown as { __r3f?: unknown }).__r3f = st;
  }, [st]);
  return null;
};

/**
 * Éclairage de la pièce.
 *
 * Volontairement réduit à trois sources douces et **fixes**. La version
 * précédente en comptait sept, dont trois ponctuelles — une au plafond, une
 * sur la lampe, et une attachée aux dés, donc mobile. Leurs halos se
 * superposaient sur le bois et produisaient des taches claires mouvantes que
 * rien ne justifiait dans la scène.
 *
 * Ici la lumière est directionnelle et constante : elle éclaire la table de
 * façon uniforme, et la seule ombre portée est celle du plateau.
 */
const Lights = memo(() => (
  <>
    <hemisphereLight args={['#FFF3DC', '#5A4632', 1.25]} />
    <ambientLight intensity={1} color="#FFF6E6" />
    {/* Source proche de la verticale : l'ombre du plateau reste ramassée
        sous lui au lieu de s'étaler en large tache sur la moitié de la table. */}
    <directionalLight
      position={[6, 38, 8]}
      intensity={2}
      color="#FFF4DE"
      castShadow
      shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
      shadow-bias={-0.0006}
    />
    {/* Appoint froid côté opposé : adoucit l'ombre sans créer de halo. */}
    <directionalLight position={[-16, 14, -12]} intensity={0.75} color="#CFE0FF" />
  </>
));
Lights.displayName = 'Lights';

/**
 * Tout ce qui ne bouge jamais : la pièce et la lumière.
 * Mémoïsé sans propriété, donc traversé une seule fois par React.
 */
const StaticWorld = memo(() => (
  <>
    <Lights />
    <Room />
  </>
));
StaticWorld.displayName = 'StaticWorld';

/** Signature du plateau : ne change qu'à un achat, une construction, une hypothèque. */
const boardSignature = (state: GameState) => {
  let sig = '';
  for (const i of Object.keys(state.tiles)) {
    const t = state.tiles[Number(i)];
    sig += `${t.owner ?? '-'}${t.level}${t.mortgaged ? 'h' : ''}|`;
  }
  return sig;
};

/**
 * Le plateau lui-même : quarante cases texturées.
 *
 * Mémoïsé sur une signature de propriété. Sans cela, les quarante composants
 * se réconciliaient à chaque pas de pion — soit toutes les 138 ms pendant un
 * déplacement.
 */
const BoardLayer = memo(
  ({ state }: { state: GameState; signature: string }) => <Board state={state} />,
  (a, b) => a.signature === b.signature,
);
BoardLayer.displayName = 'BoardLayer';

/**
 * Mesure du conteneur avant d'instancier le rendu.
 *
 * On ne s'en sert que comme verrou booléen : la taille en pixels n'est plus
 * imposée au Canvas, qui se mesure lui-même. Imposer une taille suivie par un
 * observateur provoquait un redimensionnement à chaque variation de hauteur —
 * or sur mobile la barre d'URL en fait varier en permanence.
 */
const useHasSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [pret, setPret] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lire = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setPret(true);
    };
    lire();
    const ro = new ResizeObserver(lire);
    ro.observe(el);
    // Les rappels de ResizeObserver ne sont pas délivrés tant que le document
    // est masqué : ces deux évènements, eux, arrivent.
    window.addEventListener('resize', lire);
    document.addEventListener('visibilitychange', lire);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', lire);
      document.removeEventListener('visibilitychange', lire);
    };
  }, []);
  return { ref, pret };
};

export const Scene = ({
  state,
  cinema,
  compact,
  activePlayer,
  onContextLost,
  labels,
}: {
  state: GameState;
  cinema: Cinema;
  compact: boolean;
  activePlayer: PlayerId | null;
  onContextLost?: () => void;
  labels: React.RefObject<Map<PlayerId, HTMLElement | null>>;
}) => {
  const fog = useMemo(() => new THREE.FogExp2('#241B14', 0.006), []);
  const { ref, pret } = useHasSize();
  const [polices, setPolices] = useState(false);
  const signature = boardSignature(state);

  useEffect(() => {
    let vivant = true;
    void fontsReady().then(() => {
      if (vivant) setPolices(true);
    });
    return () => {
      vivant = false;
    };
  }, []);

  // Position de repos de la caméra, recalculée uniquement au redimensionnement.
  const camera = useMemo(
    () => ({ position: [0, 30, 26] as [number, number, number], fov: compact ? 46 : 32, near: 5, far: 200 }),
    [compact],
  );

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#1C1611' }}>
      {pret && polices && (
        <Canvas
          shadows={RENDER_SHADOWS}
          dpr={RENDER_DPR}
          gl={GL_PROPS}
          camera={camera}
          style={CANVAS_STYLE}
          onCreated={({ gl }) => {
            setMaxAnisotropy(gl.capabilities.getMaxAnisotropy());
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              onContextLost?.();
            });
          }}
        >
          <color attach="background" args={['#1C1611']} />
          <primitive attach="fog" object={fog} />

          {import.meta.env.DEV && <DevHandle />}
          <StaticWorld />

          <Suspense fallback={null}>
            <BoardLayer state={state} signature={signature} />
            <Buildings state={state} />
            <Tokens
              state={state}
              tokenTile={cinema.tokenTile}
              activePlayer={activePlayer}
              labels={labels}
            />
            <Dice dice={cinema.dice} at={DICE_AT} />
          </Suspense>

          <Board.Overlays
            highlight={cinema.highlight}
            destination={cinema.destination}
            purchase={cinema.purchase}
          />
          <FollowCamera compact={compact} follow={cinema.follow} />
        </Canvas>
      )}
    </div>
  );
};

/** Les dés roulent au centre du plateau, emplacement fixe et dégagé. */
const DICE_AT: [number, number, number] = [0, 0, 4.2];
