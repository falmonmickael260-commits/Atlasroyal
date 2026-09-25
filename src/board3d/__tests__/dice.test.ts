import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FACE_ORDER, restFor } from '../diceFaces';

/** Normales des faces d'une BoxGeometry, dans l'ordre des matériaux. */
const NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const UP = new THREE.Vector3(0, 1, 0);

/** Quelle valeur se retrouve tournée vers le haut pour une rotation donnée. */
const faceUp = (rot: [number, number, number]): number => {
  const e = new THREE.Euler(...rot);
  let best = -1;
  let bestDot = -2;
  NORMALS.forEach((n, i) => {
    const d = n.clone().applyEuler(e).dot(UP);
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  });
  return FACE_ORDER[best];
};

describe('orientation des dés', () => {
  it('a des faces opposées dont la somme fait 7, comme un vrai dé', () => {
    expect(FACE_ORDER[0] + FACE_ORDER[1]).toBe(7);
    expect(FACE_ORDER[2] + FACE_ORDER[3]).toBe(7);
    expect(FACE_ORDER[4] + FACE_ORDER[5]).toBe(7);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'présente bien la face %i vers le haut au repos',
    (value) => {
      expect(faceUp(restFor(value))).toBe(value);
    },
  );
});
