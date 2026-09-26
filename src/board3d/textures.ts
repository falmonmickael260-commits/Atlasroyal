import * as THREE from 'three';
import { GROUPS } from '../engine/board';
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
  const g = c.createLinearGradient(0, 0, 0, d);
  g.addColorStop(0, '#2C3B54');
  g.addColorStop(1, '#1F2C42');
  c.fillStyle = g;
  c.fillRect(0, 0, w, d);

  c.strokeStyle = 'rgba(255,255,255,0.18)';
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
      { max: 40, min: 15, color: '#F8FAFC' },
    );

    // Prix, sur un bandeau sombre qui le détache du fond.
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0.05, d - 0.52, w - 0.1, 0.47);
    fitBlock(
      c,
      `${tile.price.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      { x: 0.1, y: d - 0.5, w: w - 0.2, h: 0.42 },
      { max: 24, min: 12, color: '#F5D97B', lignes: 1 },
    );
  } else if (tile.kind === 'hub' || tile.kind === 'reseau') {
    const teinte = tile.kind === 'hub' ? '#60A5FA' : '#22C55E';
    c.fillStyle = tile.kind === 'hub' ? 'rgba(96,165,250,0.2)' : 'rgba(34,197,94,0.2)';
    roundRect(c, 0.07, 0.07, w - 0.14, d - 0.14, 0.1);
    c.fill();
    c.strokeStyle = `${teinte}66`;
    c.lineWidth = 0.03;
    roundRect(c, 0.07, 0.07, w - 0.14, d - 0.14, 0.1);
    c.stroke();

    fitBlock(
      c,
      tile.name.toUpperCase(),
      { x: 0.12, y: 0.4, w: w - 0.24, h: d - 1.1 },
      { max: 32, min: 13, color: '#E8EEF7' },
    );
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(0.05, d - 0.5, w - 0.1, 0.45);
    fitBlock(
      c,
      `${tile.price.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      { x: 0.1, y: d - 0.48, w: w - 0.2, h: 0.4 },
      { max: 22, min: 12, color: '#F5D97B', lignes: 1 },
    );
  } else if (tile.kind === 'tax') {
    c.fillStyle = 'rgba(220,38,38,0.18)';
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
      { max: 30, min: 13, color: '#FECACA' },
    );
    fitBlock(
      c,
      `− ${tile.amount.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      { x: 0.1, y: d - 0.56, w: w - 0.2, h: 0.46 },
      { max: 26, min: 13, color: '#F8FAFC', lignes: 1 },
    );
  } else if (tile.kind === 'card') {
    // Une case carte doit s'expliquer sans ouvrir de menu : un dos de carte
    // dessiné, le nom de la pioche, et l'action écrite en toutes lettres.
    const isDestin = tile.deck === 'destin';
    const tint = isDestin ? '#D183F5' : '#FFB24D';
    c.fillStyle = isDestin ? 'rgba(139,47,184,0.26)' : 'rgba(217,119,6,0.26)';
    roundRect(c, 0.08, 0.08, w - 0.16, d - 0.16, 0.1);
    c.fill();

    fitBlock(c, isDestin ? 'DESTIN' : 'MARCHÉ', { x: 0.1, y: 0.16, w: w - 0.2, h: 0.46 },
      { max: 30, min: 14, color: tint, lignes: 1 });

    // Deux cartes en éventail, dos visible.
    const cx = w / 2;
    const cy = d / 2 + 0.05;
    for (const [dx, rot, alpha] of [[-0.1, -0.22, 0.55], [0.06, 0.16, 1]] as const) {
      c.save();
      c.translate(cx + dx, cy);
      c.rotate(rot);
      c.globalAlpha = alpha;
      c.fillStyle = isDestin ? '#3B1650' : '#4A2B08';
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
      { max: 19, min: 10, color: '#E8EEF7', lignes: 2 });
  } else {
    // Coins
    const tones: Record<string, [string, string]> = {
      depart: ['rgba(34,197,94,0.22)', '#86EFAC'],
      prison: ['rgba(148,163,184,0.18)', '#CBD5E1'],
      parc: ['rgba(234,179,8,0.22)', '#FDE68A'],
      gotoprison: ['rgba(220,38,38,0.22)', '#FCA5A5'],
    };
    const [bg, fg] = tones[tile.kind] ?? ['rgba(255,255,255,0.08)', '#F8FAFC'];
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
  base.addColorStop(0, '#5A3A22');
  base.addColorStop(0.45, '#6B472A');
  base.addColorStop(1, '#4E3120');
  c.fillStyle = base;
  c.fillRect(0, 0, size, size);

  // Veines : des sinusoïdes de fréquences variées le long des lames.
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * size;
    const amp = 0.05 + Math.random() * 0.22;
    const freq = 0.6 + Math.random() * 2.4;
    const dark = Math.random() > 0.5;
    c.strokeStyle = dark
      ? `rgba(40, 24, 13, ${0.05 + Math.random() * 0.16})`
      : `rgba(150, 105, 66, ${0.04 + Math.random() * 0.1})`;
    c.lineWidth = 0.008 + Math.random() * 0.03;
    c.beginPath();
    for (let x = 0; x <= size; x += 0.12) {
      const yy = y + Math.sin(x * freq + i) * amp;
      x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
    }
    c.stroke();
  }

  // Joints de lames.
  c.strokeStyle = 'rgba(28, 16, 8, 0.45)';
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

/** Tapis central : méridiens + logo. */
export const centerTexture = (size: number): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(size, size);
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#1E5442');
  g.addColorStop(0.55, '#174537');
  g.addColorStop(1, '#123528');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);

  c.strokeStyle = 'rgba(234,179,8,0.2)';
  c.lineWidth = 0.02;
  for (let r = 1.4; r < size / 2; r += 1.25) {
    c.beginPath();
    c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,0.09)';
  for (let a = 0; a < 12; a++) {
    const th = (a / 12) * Math.PI * 2;
    c.beginPath();
    c.moveTo(size / 2, size / 2);
    c.lineTo(size / 2 + Math.cos(th) * size / 2, size / 2 + Math.sin(th) * size / 2);
    c.stroke();
  }

  c.save();
  c.translate(size / 2, size / 2);
  c.rotate(-Math.PI / 4);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = 'rgba(234,179,8,0.85)';
  c.font = `700 ${2.1}px "Space Grotesk", sans-serif`;
  c.fillText('ATLAS', 0, -1.1);
  c.fillStyle = 'rgba(248,250,252,0.9)';
  c.fillText('ROYALE', 0, 1.2);
  c.strokeStyle = 'rgba(234,179,8,0.5)';
  c.lineWidth = 0.05;
  c.beginPath();
  c.moveTo(-3.4, 0.05); c.lineTo(-1.2, 0.05);
  c.moveTo(1.2, 0.05); c.lineTo(3.4, 0.05);
  c.stroke();
  c.restore();

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
