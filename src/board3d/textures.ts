import * as THREE from 'three';
import { BOARD, GROUPS } from '../engine/board';
import { DISPLAY_FONT } from './fonts';
import type { Tile } from '../engine/types';

/**
 * Les faces de cases sont peintes au Canvas 2D puis uploadées une seule fois
 * en texture. Cela évite tout chargement de police 3D (troika/CDN) et donne
 * une typographie nette, contrôlée au pixel près.
 */
/**
 * Densité des textures peintes, en pixels par unité monde.
 *
 * Le plateau est vu de biais : c'est le filtrage anisotrope qui sauve la
 * lisibilité, mais il ne peut pas inventer des pixels absents. On monte donc
 * la densité, en la plafonnant sur mobile où la mémoire graphique est comptée.
 */
let DPI = 256;

export const setTextureDensity = (dpi: number) => {
  DPI = dpi;
};

/** Anisotropie maximale du contexte, renseignée au démarrage du rendu. */
let MAX_ANISO = 8;
export const setMaxAnisotropy = (v: number) => {
  MAX_ANISO = Math.max(1, v);
};

const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};


/** Découpe un titre en au plus `maxLignes`, en équilibrant les lignes. */
const wrapWords = (text: string, maxLignes: number): string[] => {
  const mots = text.split(' ');
  if (mots.length === 1 || maxLignes === 1) return [text];
  if (mots.length === 2) return mots;
  const milieu = Math.ceil(mots.length / 2);
  return [mots.slice(0, milieu).join(' '), mots.slice(milieu).join(' ')];
};

/**
 * Titre d'une case : la plus grande taille qui tient dans la boîte donnée.
 *
 * Le nom de la ville est l'information que le joueur cherche en premier ;
 * on lui donne donc toute la place disponible plutôt qu'une taille fixe
 * choisie pour que le pire cas rentre.
 */
const fitBlock = (
  c: CanvasRenderingContext2D,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  opts: { max: number; min: number; color: string; weight?: number; lignes?: number },
) => {
  const { max, min, color, weight = 700, lignes: maxLignes = 2 } = opts;
  const font = (v: number) => `${weight} ${v / 100}px ${DISPLAY_FONT}`;

  for (let size = max; size >= min; size -= 1) {
    for (const n of [1, maxLignes]) {
      const lignes = wrapWords(text, n);
      if (lignes.length > n) continue;
      c.font = font(size);
      const large = lignes.every((l) => c.measureText(l).width <= box.w);
      const interligne = (size / 100) * 1.06;
      const haut = lignes.length * interligne;
      if (large && haut <= box.h) {
        c.fillStyle = color;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const y0 = box.y + box.h / 2 - ((lignes.length - 1) * interligne) / 2;
        lignes.forEach((l, i) => c.fillText(l, box.x + box.w / 2, y0 + i * interligne));
        return size;
      }
    }
  }
  return min;
};

const makeCanvas = (w: number, h: number) => {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * DPI);
  cv.height = Math.round(h * DPI);
  const c = cv.getContext('2d', { alpha: true })!;
  c.scale(DPI, DPI);
  c.textRendering = 'geometricPrecision';
  return { cv, c };
};

const finish = (cv: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

/** Face supérieure d'une case. `w`/`d` en unités monde, bande de groupe en haut. */
export const tileTexture = (tile: Tile, w: number, d: number): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(w, d);

  // Fond feutre
  // Carton clair plutôt que fond sombre : c'est ce qui donne à un plateau son
  // aspect imprimé, et ce qui rend les noms et les prix réellement lisibles.
  const g = c.createLinearGradient(0, 0, 0, d);
  g.addColorStop(0, '#F6F0E4');
  g.addColorStop(1, '#E9E0CE');
  c.fillStyle = g;
  c.fillRect(0, 0, w, d);

  c.strokeStyle = 'rgba(30,38,54,0.22)';
  c.lineWidth = 0.02;
  c.strokeRect(0.01, 0.01, w - 0.02, d - 0.02);


  if (tile.kind === 'city') {
    const grp = GROUPS[tile.group];

    // Bande de groupe, côté intérieur du plateau. Plus haute qu'avant : c'est
    // elle qu'on identifie de loin, avant même de lire le nom.
    const band = c.createLinearGradient(0, 0.04, 0, 0.56);
    band.addColorStop(0, grp.glow);
    band.addColorStop(1, grp.color);
    c.fillStyle = band;
    c.fillRect(0.05, 0.05, w - 0.1, 0.5);
    // Ombre portée sous la bande : la case gagne une épaisseur.
    const ombre = c.createLinearGradient(0, 0.55, 0, 0.72);
    ombre.addColorStop(0, 'rgba(0,0,0,0.35)');
    ombre.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ombre;
    c.fillRect(0.05, 0.55, w - 0.1, 0.17);

    // Le nom occupe tout l'espace disponible — c'est l'information
    // principale. Le pays disparaît de la case : il encombrait sans servir,
    // et reste consultable sur la fiche de propriété.
    fitBlock(
      c,
      tile.name.toUpperCase(),
      { x: 0.1, y: 0.66, w: w - 0.2, h: d - 1.28 },
      { max: 40, min: 15, color: '#1B2434' },
    );

    // Prix, sur un bandeau sombre qui le détache du fond.
    c.fillStyle = 'rgba(27,36,52,0.08)';
    c.fillRect(0.05, d - 0.52, w - 0.1, 0.47);
    fitBlock(
      c,
      `${tile.price.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      { x: 0.1, y: d - 0.5, w: w - 0.2, h: 0.42 },
      { max: 24, min: 12, color: '#3C4A63', lignes: 1 },
    );
  } else if (tile.kind === 'hub' || tile.kind === 'reseau') {
    const teinte = tile.kind === 'hub' ? '#60A5FA' : '#22C55E';
    c.fillStyle = tile.kind === 'hub' ? 'rgba(37,99,235,0.14)' : 'rgba(21,128,61,0.14)';
    roundRect(c, 0.07, 0.07, w - 0.14, d - 0.14, 0.1);
    c.fill();
    c.strokeStyle = `${teinte}99`;
    c.lineWidth = 0.03;
    roundRect(c, 0.07, 0.07, w - 0.14, d - 0.14, 0.1);
    c.stroke();

    fitBlock(
      c,
      tile.name.toUpperCase(),
      { x: 0.12, y: 0.4, w: w - 0.24, h: d - 1.1 },
      { max: 32, min: 13, color: '#1B2434' },
    );
    c.fillStyle = 'rgba(27,36,52,0.08)';
    c.fillRect(0.05, d - 0.5, w - 0.1, 0.45);
    fitBlock(
      c,
      `${tile.price.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      { x: 0.1, y: d - 0.48, w: w - 0.2, h: 0.4 },
      { max: 22, min: 12, color: '#3C4A63', lignes: 1 },
    );
  } else if (tile.kind === 'tax') {
    c.fillStyle = 'rgba(220,38,38,0.13)';
    roundRect(c, 0.07, 0.07, w - 0.14, d - 0.14, 0.1);
    c.fill();
    c.strokeStyle = 'rgba(248,113,113,0.42)';
    c.lineWidth = 0.03;
    roundRect(c, 0.07, 0.07, w - 0.14, d - 0.14, 0.1);
    c.stroke();
    fitBlock(
      c,
      tile.name.toUpperCase(),
      { x: 0.12, y: 0.42, w: w - 0.24, h: d - 1.16 },
      { max: 30, min: 13, color: '#8E1B1B' },
    );
    fitBlock(
      c,
      `− ${tile.amount.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      { x: 0.1, y: d - 0.56, w: w - 0.2, h: 0.46 },
      { max: 26, min: 13, color: '#1B2434', lignes: 1 },
    );
  } else if (tile.kind === 'card') {
    // Une case carte doit s'expliquer sans ouvrir de menu : un dos de carte
    // dessiné, le nom de la pioche, et l'action écrite en toutes lettres.
    const isDestin = tile.deck === 'destin';
    const tint = isDestin ? '#D183F5' : '#FFB24D';
    c.fillStyle = isDestin ? 'rgba(139,47,184,0.16)' : 'rgba(217,119,6,0.18)';
    roundRect(c, 0.08, 0.08, w - 0.16, d - 0.16, 0.1);
    c.fill();

    fitBlock(c, isDestin ? 'DESTIN' : 'MARCHÉ', { x: 0.1, y: 0.16, w: w - 0.2, h: 0.46 },
      { max: 30, min: 14, color: isDestin ? '#5B1C7A' : '#8A4A05', lignes: 1 });

    // Deux cartes en éventail, dos visible.
    const cx = w / 2;
    const cy = d / 2 + 0.05;
    for (const [dx, rot, alpha] of [[-0.1, -0.22, 0.55], [0.06, 0.16, 1]] as const) {
      c.save();
      c.translate(cx + dx, cy);
      c.rotate(rot);
      c.globalAlpha = alpha;
      c.fillStyle = isDestin ? '#5B1C7A' : '#8A4A05';
      roundRect(c, -0.3, -0.42, 0.6, 0.84, 0.08);
      c.fill();
      c.strokeStyle = tint;
      c.lineWidth = 0.028;
      roundRect(c, -0.3, -0.42, 0.6, 0.84, 0.08);
      c.stroke();
      c.fillStyle = tint;
      c.beginPath();
      c.arc(0, 0, 0.11, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    fitBlock(c, 'PIOCHE UNE CARTE', { x: 0.08, y: d - 0.56, w: w - 0.16, h: 0.48 },
      { max: 19, min: 10, color: '#3C4A63', lignes: 2 });
  } else {
    // Coins
    const tones: Record<string, [string, string]> = {
      depart: ['rgba(22,163,74,0.18)', '#0F5C2E'],
      prison: ['rgba(71,85,105,0.14)', '#2A3647'],
      parc: ['rgba(234,179,8,0.22)', '#7A5A06'],
      gotoprison: ['rgba(220,38,38,0.18)', '#8E1B1B'],
    };
    const [bg, fg] = tones[tile.kind] ?? ['rgba(27,36,52,0.08)', '#1B2434'];
    c.fillStyle = bg;
    roundRect(c, 0.1, 0.1, w - 0.2, d - 0.2, 0.14);
    c.fill();
    fitBlock(
      c,
      tile.name.toUpperCase(),
      { x: 0.18, y: 0.3, w: w - 0.36, h: d - 0.6 },
      { max: 46, min: 16, color: fg, lignes: 2 },
    );
  }

  return finish(cv);
};

/** Face de dé : pastille blanche, points noirs. */
export const diceFaceTexture = (value: number): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(1, 1);
  const grad = c.createLinearGradient(0, 0, 1, 1);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(1, '#E2E8F0');
  c.fillStyle = grad;
  roundRect(c, 0.02, 0.02, 0.96, 0.96, 0.18);
  c.fill();

  const p = [0.27, 0.5, 0.73];
  const layouts: Record<number, Array<[number, number]>> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };
  c.fillStyle = '#0B1220';
  for (const [x, y] of layouts[value]) {
    c.beginPath();
    c.arc(p[x], p[y], 0.085, 0, Math.PI * 2);
    c.fill();
  }
  return finish(cv);
};

/**
 * Plateau de table en bois. Généré : veines, nœuds et lames légèrement
 * contrastées, pour que le plateau repose sur quelque chose de tangible
 * plutôt que de flotter dans le noir.
 */
export const woodTexture = (size = 12): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(size, size);

  const base = c.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#9C7249');
  base.addColorStop(0.45, '#B08458');
  base.addColorStop(1, '#8A6440');
  c.fillStyle = base;
  c.fillRect(0, 0, size, size);

  // Veines : des sinusoïdes de fréquences variées le long des lames.
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * size;
    const amp = 0.05 + Math.random() * 0.22;
    const freq = 0.6 + Math.random() * 2.4;
    const dark = Math.random() > 0.5;
    c.strokeStyle = dark
      ? `rgba(62, 38, 20, ${0.05 + Math.random() * 0.14})`
      : `rgba(186, 140, 95, ${0.05 + Math.random() * 0.12})`;
    c.lineWidth = 0.008 + Math.random() * 0.03;
    c.beginPath();
    for (let x = 0; x <= size; x += 0.12) {
      const yy = y + Math.sin(x * freq + i) * amp;
      x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
    }
    c.stroke();
  }

  // Joints de lames.
  c.strokeStyle = 'rgba(52, 32, 17, 0.38)';
  c.lineWidth = 0.02;
  for (let y = 1.5; y < size; y += 1.9) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(size, y);
    c.stroke();
  }

  const tex = finish(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

/*
  Tapis central : planisphère gravé.

  Les villes du plateau portent déjà leur latitude et leur longitude ; le
  centre les montre à leur vraie place. Les contours sont un tracé original
  et volontairement grossier — une quinzaine de sommets par continent —, ce
  qui suffit à la lecture à cette échelle et se dessine en quelques
  millisecondes, sans aucun fichier à charger.

  Coordonnées en degrés : longitude de -180 à 180, latitude de 90 à -90.
*/
const TERRES: [number, number][][] = [
  // Amérique du Nord, isthme compris
  [[-168, 65], [-158, 71], [-140, 70], [-125, 70], [-108, 69], [-95, 70], [-82, 73], [-70, 66],
   [-60, 55], [-66, 48], [-70, 43], [-75, 35], [-81, 25], [-90, 29], [-97, 26], [-94, 18],
   [-88, 16], [-83, 9], [-78, 8], [-82, 15], [-92, 20], [-105, 21], [-115, 30], [-125, 40],
   [-130, 55], [-150, 60]],
  // Amérique du Sud
  [[-78, 8], [-70, 11], [-60, 10], [-50, 0], [-35, -5], [-38, -15], [-48, -25], [-58, -35],
   [-62, -42], [-68, -53], [-73, -50], [-72, -40], [-70, -25], [-75, -15], [-80, -5]],
  // Afrique
  [[-17, 15], [-16, 21], [-10, 30], [0, 35], [10, 37], [20, 32], [32, 31], [35, 25], [40, 15],
   [43, 11], [51, 12], [49, 2], [40, -5], [40, -15], [35, -22], [32, -28], [25, -34], [18, -34],
   [12, -18], [9, -2], [5, 5], [-5, 5], [-12, 8]],
  // Eurasie
  [[-10, 36], [0, 44], [3, 43], [5, 51], [-2, 51], [-5, 58], [8, 62], [16, 55], [21, 56],
   [28, 60], [30, 70], [45, 68], [60, 70], [75, 73], [90, 75], [105, 77], [120, 73], [140, 72],
   [160, 68], [178, 66], [168, 60], [158, 57], [145, 55], [140, 45], [130, 35], [122, 30],
   [117, 22], [108, 15], [100, 10], [97, 16], [90, 22], [82, 16], [75, 8], [70, 22], [60, 25],
   [48, 30], [43, 37], [35, 36], [28, 38], [20, 40], [15, 38], [10, 44], [2, 42]],
  // Australie
  [[113, -22], [114, -34], [129, -32], [137, -35], [141, -38], [147, -43], [153, -28],
   [145, -15], [135, -12], [127, -14], [122, -18]],
  // Groenland
  [[-45, 60], [-22, 70], [-20, 82], [-45, 84], [-60, 80], [-55, 70]],
  // Îles britanniques
  [[-5, 50], [-1, 53], [-3, 58], [-6, 56], [-6, 52]],
  // Japon
  [[130, 31], [136, 35], [141, 38], [145, 44], [142, 44], [138, 37], [133, 34], [129, 32]],
  // Madagascar
  [[43, -12], [50, -16], [49, -25], [45, -24]],
  // Indonésie
  [[95, 5], [105, 0], [116, -3], [128, -4], [141, -3], [141, -9], [120, -9], [105, -7], [97, 2]],
  // Nouvelle-Zélande
  [[173, -35], [178, -39], [172, -45], [167, -46], [170, -40]],
];

export const centerTexture = (size: number): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(size, size);

  // Océan : un dégradé radial, plus clair au centre, qui garde la matière
  // feutrée du tapis tout en se lisant comme de l'eau.
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 1.6);
  g.addColorStop(0, '#3FA07A');
  g.addColorStop(0.55, '#338A68');
  g.addColorStop(1, '#276F53');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);

  // Bande cartographique : rapport 2:1, centrée, laissant le titre au fond
  // et la zone des dés au premier plan.
  const largeur = size * 0.94;
  const hauteur = largeur / 2;
  const x0 = (size - largeur) / 2;
  const y0 = size * 0.27;
  const px = (lon: number) => x0 + ((lon + 180) / 360) * largeur;
  const py = (lat: number) => y0 + ((90 - lat) / 180) * hauteur;

  // Graticule : repères tous les 30°, assez discrets pour rester un fond.
  c.strokeStyle = 'rgba(250, 236, 200, 0.14)';
  c.lineWidth = size * 0.0012;
  for (let lon = -150; lon <= 150; lon += 30) {
    c.beginPath(); c.moveTo(px(lon), py(90)); c.lineTo(px(lon), py(-90)); c.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    c.beginPath(); c.moveTo(px(-180), py(lat)); c.lineTo(px(180), py(lat)); c.stroke();
  }
  // Équateur marqué.
  c.strokeStyle = 'rgba(250, 214, 110, 0.3)';
  c.lineWidth = size * 0.002;
  c.beginPath(); c.moveTo(px(-180), py(0)); c.lineTo(px(180), py(0)); c.stroke();

  // Terres émergées : aplat sable, liseré doré.
  c.lineJoin = 'round';
  c.lineWidth = size * 0.0022;
  for (const terre of TERRES) {
    c.beginPath();
    terre.forEach(([lon, lat], i) => (i ? c.lineTo(px(lon), py(lat)) : c.moveTo(px(lon), py(lat))));
    c.closePath();
    // Ombre portée très douce : elle décolle les côtes de l'océan, sans quoi
    // les deux aplats se touchent et la carte paraît imprimée à plat.
    c.save();
    c.shadowColor = 'rgba(14, 44, 32, 0.55)';
    c.shadowBlur = size * 0.012;
    c.shadowOffsetY = size * 0.002;
    c.fillStyle = '#EFE4C8';
    c.fill();
    c.restore();
    c.strokeStyle = 'rgba(176, 134, 64, 0.8)';
    c.stroke();
  }

  // Les vingt-deux métropoles du plateau, à leur place réelle.
  for (const t of BOARD) {
    if (t.kind !== 'city') continue;
    const x = px(t.lon);
    const y = py(t.lat);
    const r = size * 0.0062;
    c.beginPath();
    c.arc(x, y, r * 2.6, 0, Math.PI * 2);
    c.fillStyle = 'rgba(234, 179, 8, 0.22)';
    c.fill();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = '#F6C445';
    c.fill();
    c.strokeStyle = 'rgba(60, 40, 10, 0.55)';
    c.lineWidth = size * 0.0008;
    c.stroke();
  }

  // Titre au fond du tapis : la zone proche reste libre pour les dés.
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const h = size * 0.062;
  c.font = `700 ${h}px ${DISPLAY_FONT}`;
  c.fillStyle = 'rgba(248, 243, 230, 0.92)';
  c.fillText('FORTUNE CITY', size / 2, size * 0.135);
  c.font = `600 ${h * 0.34}px ${DISPLAY_FONT}`;
  c.fillStyle = 'rgba(250, 214, 110, 0.8)';
  c.fillText('VINGT-DEUX MÉTROPOLES · UNE SEULE COURONNE', size / 2, size * 0.185);
  c.strokeStyle = 'rgba(250, 214, 110, 0.45)';
  c.lineWidth = size * 0.0016;
  const demi = size * 0.2;
  c.beginPath();
  c.moveTo(size / 2 - demi, size * 0.165); c.lineTo(size / 2 - demi * 0.42, size * 0.165);
  c.moveTo(size / 2 + demi * 0.42, size * 0.165); c.lineTo(size / 2 + demi, size * 0.165);
  c.stroke();

  return finish(cv);
};

/** Papier peint : grain très fin, pour que le mur ne soit pas un aplat mort. */
export const wallTexture = (size = 8): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(size, size);
  const g = c.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#D8CBB4');
  g.addColorStop(1, '#C3B49A');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '120,102,80'}, ${Math.random() * 0.07})`;
    c.fillRect(Math.random() * size, Math.random() * size, 0.035, 0.035);
  }
  const tex = finish(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

/** Tapis : trame tissée et bordure, vu de loin donc volontairement sobre. */
export const rugTexture = (size = 10): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(size, size);
  c.fillStyle = '#6B3F3A';
  c.fillRect(0, 0, size, size);
  c.strokeStyle = 'rgba(0,0,0,0.16)';
  c.lineWidth = 0.02;
  for (let i = 0; i < size; i += 0.1) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i, size); c.stroke();
    c.beginPath(); c.moveTo(0, i); c.lineTo(size, i); c.stroke();
  }
  c.strokeStyle = '#8E5A4A';
  c.lineWidth = 0.34;
  c.strokeRect(size * 0.11, size * 0.11, size * 0.78, size * 0.78);
  c.strokeStyle = '#C89B6A';
  c.lineWidth = 0.12;
  c.strokeRect(size * 0.17, size * 0.17, size * 0.66, size * 0.66);
  return finish(cv);
};
