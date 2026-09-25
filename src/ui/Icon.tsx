/**
 * Jeu d'icônes SVG dessinées pour le projet (aucun emoji comme icône :
 * rendu inconsistant entre plateformes et illisible en petite taille).
 */
export type IconName =
  | 'dice' | 'globe' | 'lock' | 'trophy' | 'coins' | 'swap' | 'check' | 'close'
  | 'users' | 'copy' | 'sound' | 'mute' | 'music' | 'home' | 'building' | 'plane'
  | 'chevron' | 'plus' | 'minus' | 'crown' | 'bank' | 'spark' | 'exit' | 'card'
  | 'hammer' | 'shield' | 'link' | 'menu' | 'eye';

const P: Record<IconName, string> = {
  dice: 'M5 8.5 12 5l7 3.5v7L12 19l-7-3.5v-7Z M12 5v14 M5 8.5 12 12l7-3.5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3c2.5 2.6 2.5 15.4 0 18 M12 3c-2.5 2.6-2.5 15.4 0 18',
  lock: 'M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4Z M7 6H4v2a3 3 0 0 0 3 3 M17 6h3v2a3 3 0 0 1-3 3 M10 19h4 M12 14v5',
  coins: 'M9 8.5c3.3 0 6-1.1 6-2.5S12.3 3.5 9 3.5 3 4.6 3 6s2.7 2.5 6 2.5Z M3 6v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6 M15 12.5c3.3 0 6-1.1 6-2.5 M9 13.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-7',
  swap: 'M4 8h13l-3.5-3.5 M20 16H7l3.5 3.5',
  check: 'm4.5 12.5 5 5 10-11',
  close: 'M6 6l12 12M18 6 6 18',
  users: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 5.2a3.5 3.5 0 0 1 0 6.6 M17 14.3c2.4.8 4 3 4 5.7',
  copy: 'M9 9h10v11H9z M15 9V4H5v11h4',
  sound: 'M4 9.5h3.5L12 5v14l-4.5-4.5H4v-5Z M16 9a4 4 0 0 1 0 6 M18.5 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5v14l-4.5-4.5H4v-5Z M16.5 9.5l5 5 M21.5 9.5l-5 5',
  music: 'M9 18V6l11-2v12 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z M20 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  home: 'M4 11 12 4l8 7 M6.5 9.5V20h11V9.5 M10 20v-5h4v5',
  building: 'M5 21V6l7-3 7 3v15 M9 9h2M13 9h2M9 13h2M13 13h2M9 17h6',
  plane: 'M3 13.5 21 6l-4 8.5-2.5 5.5-1.5-5-5.5-1.5Z',
  chevron: 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  crown: 'M4 17h16 M4 17 3 7l5 4 4-6 4 6 5-4-1 10',
  bank: 'M3 10 12 4l9 6 M5 10v9M9.5 10v9M14.5 10v9M19 10v9 M3 20h18',
  spark: 'M12 3v5M12 16v5M3 12h5M16 12h5 M6.5 6.5 9 9M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5',
  exit: 'M14 4h5v16h-5 M10 8l-4 4 4 4 M6 12h9',
  card: 'M3 7h18v11H3z M3 11h18 M7 15h3',
  hammer: 'm12 8 4-4 5 5-4 4-5-5Z M10.5 9.5 3 17v4h4l7.5-7.5',
  shield: 'M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6l-7-3Z',
  link: 'M10 14a4 4 0 0 0 5.7 0l2.8-2.8A4 4 0 0 0 12.8 5.5L11.4 7 M14 10a4 4 0 0 0-5.7 0l-2.8 2.8A4 4 0 0 0 11.2 18.5L12.6 17',
  menu: 'M4 7h16M4 12h16M4 17h16',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
};

export const Icon = ({
  name, size = 20, className, strokeWidth = 1.7, style,
}: {
  name: IconName; size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties;
}) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    className={className} style={style} aria-hidden="true" focusable="false"
  >
    {P[name].split(' M').map((d, i) => (
      <path key={i} d={i === 0 ? d : `M${d}`} />
    ))}
  </svg>
);
