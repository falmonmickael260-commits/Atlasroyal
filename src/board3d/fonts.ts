/**
 * Attente des polices avant la peinture des textures.
 *
 * Les faces de cases sont dessinées au Canvas une seule fois, au montage.
 * Si les fontes ne sont pas encore arrivées, tout le plateau est peint dans
 * la police de repli du système — et comme la texture n'est jamais repeinte,
 * il le reste pour toute la partie. C'est la principale raison pour laquelle
 * le plateau paraissait quelconque.
 */
export const DISPLAY_FONT = '"Space Grotesk", system-ui, sans-serif';
export const BODY_FONT = '"DM Sans", system-ui, sans-serif';

const FACES = [
  '700 32px "Space Grotesk"',
  '600 32px "Space Grotesk"',
  '500 32px "DM Sans"',
  '700 32px "DM Sans"',
];

export const fontsReady = async (): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all(FACES.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {
    // Police indisponible : on peint avec ce qu'on a plutôt que de bloquer.
  }
};
