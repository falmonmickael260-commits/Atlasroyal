import { Composition } from 'remotion';
import {
  FortuneIntro, INTRO_FPS, INTRO_FRAMES, INTRO_HEIGHT, INTRO_WIDTH,
} from '../src/cinematic/FortuneIntro';

/**
 * Racine Remotion propre au jeu : elle n'interfère pas avec le projet vidéo
 * existant du dépôt. Rendu : `npm run game:intro:render`.
 */
export const RemotionRoot = () => (
  <Composition
    id="FortuneIntro"
    component={FortuneIntro}
    durationInFrames={INTRO_FRAMES}
    fps={INTRO_FPS}
    width={INTRO_WIDTH}
    height={INTRO_HEIGHT}
  />
);
