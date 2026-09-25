import {
  AbsoluteFill,
  Easing,
  Interactive,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadDisplay } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadBody } from '@remotion/google-fonts/DMSans';
import { BOARD } from '../engine/board';

// Chargées par la composition elle-même : le rendu MP4 ne dépend donc pas
// de la feuille de style de la page.
const { fontFamily: DISPLAY } = loadDisplay();
const { fontFamily: BODY } = loadBody();

/**
 * Générique d'ouverture d'ATLAS ROYALE.
 *
 * Écrit selon les règles Remotion : toute l'animation est pilotée par
 * `useCurrentFrame()` + `interpolate()` (aucune transition CSS, qui ne serait
 * pas rendue), les interpolations restent en ligne dans `style`, et on utilise
 * les raccourcis `scale` / `translate` / `rotate` plutôt que `transform`.
 */

export const INTRO_FPS = 30;
export const INTRO_FRAMES = 150;
export const INTRO_WIDTH = 1920;
export const INTRO_HEIGHT = 1080;

const CITIES = BOARD.filter((t) => t.kind === 'city').map((t) => t.name);
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Anneaux de méridiens qui s'ouvrent depuis le centre. */
const Meridians = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill name="Méridiens" style={{ alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 420 + i * 300,
            height: 420 + i * 300,
            borderRadius: '50%',
            border: '1px solid rgba(234,179,8,0.22)',
            opacity: interpolate(frame, [i * 4, i * 4 + 0.9 * fps], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: EASE,
            }),
            scale: interpolate(frame, [i * 4, i * 4 + 1.4 * fps], [0.6, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: EASE,
              output: 'perceptual-scale',
            }),
            rotate: interpolate(frame, [0, INTRO_FRAMES], [`${i * 8}deg`, `${i * 8 + 26}deg`], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Silhouette du plateau : 40 encoches qui s'allument une à une. */
const BoardOutline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const side = 560;
  const per = side / 11;
  const notch = (i: number) => {
    const s = i % 10;
    const edge = Math.floor(i / 10);
    const d = -side / 2 + per * (s + 1);
    if (edge === 0) return { left: d, top: -side / 2, w: per - 6, h: 10 };
    if (edge === 1) return { left: side / 2 - 10, top: d, w: 10, h: per - 6 };
    if (edge === 2) return { left: -d - per + 6, top: side / 2 - 10, w: per - 6, h: 10 };
    return { left: -side / 2, top: -d - per + 6, w: 10, h: per - 6 };
  };

  return (
    <AbsoluteFill name="Plateau" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: side,
          height: side,
          rotate: '45deg',
          scale: interpolate(frame, [2.4 * fps, 4.2 * fps], [0.82, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE,
            output: 'perceptual-scale',
          }),
        }}
      >
        {Array.from({ length: 40 }, (_, i) => {
          const at = 2.5 * fps + i * 0.9;
          const p = notch(i);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p.left + side / 2,
                top: p.top + side / 2,
                width: p.w,
                height: p.h,
                borderRadius: 3,
                background: i % 5 === 0 ? '#EAB308' : 'rgba(226,232,240,0.55)',
                opacity: interpolate(frame, [at, at + 0.5 * fps], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: EASE,
                }),
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Défilé des villes en arrière-plan. */
const CityStream = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill name="Villes" style={{ justifyContent: 'center', overflow: 'hidden' }}>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          style={{
            display: 'flex',
            gap: 64,
            whiteSpace: 'nowrap',
            fontFamily: DISPLAY,
            fontSize: 34,
            letterSpacing: '0.34em',
            color: 'rgba(148,163,184,0.3)',
            marginTop: row === 1 ? 0 : 42,
            opacity: interpolate(
              frame,
              [1.6 * fps, 2.4 * fps, 4.1 * fps, 4.9 * fps],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE },
            ),
            translate: interpolate(
              frame,
              [1.6 * fps, INTRO_FRAMES],
              [`${row % 2 === 0 ? 260 : -260}px 0px`, `${row % 2 === 0 ? -320 : 320}px 0px`],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.linear },
            ),
          }}
        >
          {CITIES.slice(row * 8, row * 8 + 8).map((c) => (
            <span key={c}>{c.toUpperCase()}</span>
          ))}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** Le titre : chaque lettre tombe puis se stabilise. */
const Masthead = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = 'ATLAS'.split('');

  return (
    <AbsoluteFill
      name="Titre"
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {letters.map((ch, i) => (
          <Interactive.Div
            key={i}
            name={`Lettre ${ch}${i}`}
            style={{
              fontFamily: DISPLAY,
              fontSize: 190,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              color: '#F8FAFC',
              opacity: interpolate(frame, [0.5 * fps + i * 2.5, 1.1 * fps + i * 2.5], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: EASE,
              }),
              translate: interpolate(
                frame,
                [0.5 * fps + i * 2.5, 1.5 * fps + i * 2.5],
                ['0px -120px', '0px 0px'],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.18, 1.4, 0.36, 1),
                },
              ),
            }}
          >
            {ch}
          </Interactive.Div>
        ))}
      </div>

      <Interactive.Div
        name="Royale"
        style={{
          fontFamily: DISPLAY,
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: '0.42em',
          marginLeft: '0.42em',
          marginTop: 10,
          color: '#EAB308',
          opacity: interpolate(frame, [1.5 * fps, 2.1 * fps], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE,
          }),
          scale: interpolate(frame, [1.5 * fps, 2.6 * fps], [0.86, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE,
            output: 'perceptual-scale',
          }),
        }}
      >
        ROYALE
      </Interactive.Div>

      <Interactive.Div
        name="Accroche"
        style={{
          marginTop: 34,
          fontFamily: BODY,
          fontSize: 27,
          letterSpacing: '0.24em',
          color: 'rgba(226,232,240,0.72)',
          opacity: interpolate(frame, [3.2 * fps, 3.9 * fps], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE,
          }),
        }}
      >
        VINGT-QUATRE VILLES · UN SEUL EMPIRE
      </Interactive.Div>
    </AbsoluteFill>
  );
};

/** Balayage doré final. */
const Sweep = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      name="Balayage"
      style={{
        background:
          'linear-gradient(105deg, transparent 38%, rgba(234,179,8,0.28) 50%, transparent 62%)',
        translate: interpolate(frame, [0.8 * fps, 2.6 * fps], ['-100% 0px', '100% 0px'], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE,
        }),
      }}
    />
  );
};

export const AtlasIntro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Générique"
      style={{
        background:
          'radial-gradient(70% 60% at 50% 42%, #0E2A22 0%, #0B1220 46%, #04070E 100%)',
      }}
    >
      <Meridians />
      <CityStream />
      <Sequence from={Math.round(2.2 * fps)} name="Plateau">
        <BoardOutline />
      </Sequence>
      <Masthead />
      <Sweep />

      {/* Fondu de sortie : le générique se fond dans l'écran d'accueil. */}
      <AbsoluteFill
        name="Fondu"
        style={{
          background: '#04070E',
          opacity: interpolate(frame, [INTRO_FRAMES - 0.7 * fps, INTRO_FRAMES], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
        }}
      />
    </AbsoluteFill>
  );
};
