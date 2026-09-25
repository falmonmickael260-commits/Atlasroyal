import { useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  AtlasIntro, INTRO_FPS, INTRO_FRAMES, INTRO_HEIGHT, INTRO_WIDTH,
} from '../cinematic/AtlasIntro';
import { audio } from '../audio/audio';
import { Icon } from './Icon';

import { SEEN_KEY } from './introSeen';

/**
 * Générique d'ouverture joué en plein écran au lancement.
 *
 * Il est rendu par `@remotion/player` : la même composition sert de séquence
 * in-game et d'export vidéo (`npm run game:intro:render`). Il est passable à
 * tout moment, et ne rejoue pas dans la même session.
 */
export const Intro = ({ onDone }: { onDone: () => void }) => {
  const ref = useRef<PlayerRef>(null);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* stockage indisponible */ }
    // Laisse le fondu se terminer avant de rendre la main.
    setTimeout(onDone, 420);
  };

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    p.play();
    const onEnded = () => finish();
    p.addEventListener('ended', onEnded);
    return () => p.removeEventListener('ended', onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Échap passe le générique, comme dans un jeu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: '#04070E',
        display: 'grid', placeItems: 'center', overflow: 'hidden',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 380ms var(--ease-out)',
      }}
    >
      <Player
        ref={ref}
        component={AtlasIntro}
        durationInFrames={INTRO_FRAMES}
        compositionWidth={INTRO_WIDTH}
        compositionHeight={INTRO_HEIGHT}
        fps={INTRO_FPS}
        style={{ width: '100%', height: '100%' }}
        // Le générique remplit l'écran : on recadre plutôt que d'ajouter des bandes.
        acknowledgeRemotionLicense
      />
      <button
        className="btn btn--ghost btn--sm"
        onClick={() => { audio.unlock(); finish(); }}
        style={{ position: 'absolute', right: 24, bottom: 24 }}
      >
        Passer <Icon name="chevron" size={14} />
      </button>
    </div>
  );
};
