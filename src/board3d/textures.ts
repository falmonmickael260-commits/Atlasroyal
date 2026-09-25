import * as THREE from 'three';
import { GROUPS } from '../engine/board';
import type { Tile } from '../engine/types';

/**
 * Les faces de cases sont peintes au Canvas 2D puis uploadées une seule fois
 * en texture. Cela évite tout chargement de police 3D (troika/CDN) et donne
 * une typographie nette, contrôlée au pixel près.
 */
const DPI = 128;

const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

const fitText = (c: CanvasRenderingContext2D, text: string, max: number, start: number, font: (s: number) => string) => {
  let size = start;
  do {
    c.font = font(size);
    if (c.measureText(text).width <= max) break;
    size -= 1;
  } while (size > 8);
  return size;
};

const makeCanvas = (w: number, h: number) => {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * DPI);
  cv.height = Math.round(h * DPI);
  const c = cv.getContext('2d')!;
  c.scale(DPI, DPI);
  return { cv, c };
};

const finish = (cv: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

/** Face supérieure d'une case. `w`/`d` en unités monde, bande de groupe en haut. */
export const tileTexture = (tile: Tile, w: number, d: number): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(w, d);

  // Fond feutre
  const g = c.createLinearGradient(0, 0, 0, d);
  g.addColorStop(0, '#132033');
  g.addColorStop(1, '#0C1626');
  c.fillStyle = g;
  c.fillRect(0, 0, w, d);

  c.strokeStyle = 'rgba(255,255,255,0.10)';
  c.lineWidth = 0.02;
  c.strokeRect(0.01, 0.01, w - 0.02, d - 0.02);

  const title = (text: string, y: number, size: number, color = '#F8FAFC', weight = 700) => {
    const s = fitText(c, text, w - 0.28, size, (v) => `${weight} ${v / 100}px "Space Grotesk", sans-serif`);
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `${weight} ${s / 100}px "Space Grotesk", sans-serif`;
    c.fillText(text, w / 2, y);
  };

  if (tile.kind === 'city') {
    const grp = GROUPS[tile.group];
    // Bande de groupe côté intérieur du plateau (haut de la texture).
    const band = c.createLinearGradient(0, 0, 0, 0.5);
    band.addColorStop(0, grp.glow);
    band.addColorStop(1, grp.color);
    c.fillStyle = band;
    c.fillRect(0.04, 0.04, w - 0.08, 0.46);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0.04, 0.44, w - 0.08, 0.06);

    const name = tile.name.toUpperCase();
    const words = name.split(' ');
    if (words.length > 1 && name.length > 9) {
      title(words[0], 0.86, 20);
      title(words.slice(1).join(' '), 1.14, 20);
      title(tile.country, 1.45, 13, '#94A3B8', 500);
    } else {
      title(name, 0.95, 24);
      title(tile.country, 1.28, 13, '#94A3B8', 500);
    }
    title(`${tile.price.toLocaleString('fr-FR')} €`, d - 0.32, 17, '#EAB308');
  } else if (tile.kind === 'hub' || tile.kind === 'reseau') {
    c.fillStyle = tile.kind === 'hub' ? 'rgba(96,165,250,0.16)' : 'rgba(34,197,94,0.16)';
    roundRect(c, 0.08, 0.08, w - 0.16, d - 0.16, 0.1);
    c.fill();
    const words = tile.name.split(' ');
    title(words[0].toUpperCase(), d / 2 - 0.24, 18, '#CBD5E1');
    title(words.slice(1).join(' ').toUpperCase(), d / 2 + 0.02, 18, '#CBD5E1');
    title(`${tile.price.toLocaleString('fr-FR')} €`, d - 0.3, 15, '#EAB308');
  } else if (tile.kind === 'tax') {
    c.fillStyle = 'rgba(220,38,38,0.14)';
    roundRect(c, 0.08, 0.08, w - 0.16, d - 0.16, 0.1);
    c.fill();
    title(tile.name.toUpperCase(), d / 2 - 0.12, 17, '#FCA5A5');
    title(`− ${tile.amount.toLocaleString('fr-FR')} €`, d / 2 + 0.22, 18, '#F8FAFC');
  } else if (tile.kind === 'card') {
    const isDestin = tile.deck === 'destin';
    c.fillStyle = isDestin ? 'rgba(139,47,184,0.2)' : 'rgba(217,119,6,0.2)';
    roundRect(c, 0.08, 0.08, w - 0.16, d - 0.16, 0.1);
    c.fill();
    title(isDestin ? 'DESTIN' : 'MARCHÉ', d / 2, 22, isDestin ? '#D183F5' : '#FFB24D');
    title('◆ ◆ ◆', d / 2 + 0.34, 14, 'rgba(255,255,255,0.35)', 500);
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
    const parts = tile.name.toUpperCase().split(' ');
    parts.forEach((p, i) => title(p, d / 2 - (parts.length - 1) * 0.16 + i * 0.32, 22, fg));
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

/** Tapis central : méridiens + logo. */
export const centerTexture = (size: number): THREE.CanvasTexture => {
  const { cv, c } = makeCanvas(size, size);
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#0E2A22');
  g.addColorStop(0.55, '#0B1E1A');
  g.addColorStop(1, '#081420');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);

  c.strokeStyle = 'rgba(234,179,8,0.13)';
  c.lineWidth = 0.02;
  for (let r = 1.4; r < size / 2; r += 1.25) {
    c.beginPath();
    c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,0.06)';
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
