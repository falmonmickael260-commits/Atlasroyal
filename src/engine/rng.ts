/**
 * PRNG déterministe (xorshift32). L'état vit dans GameState, jamais en module :
 * deux autorités partant du même seed produisent exactement la même partie,
 * et rejouer une liste de commandes est reproductible (cf. tests).
 */
export const nextRng = (s: number): number => {
  let x = s | 0;
  if (x === 0) x = 0x9e3779b9;
  x ^= x << 13; x |= 0;
  x ^= x >>> 17;
  x ^= x << 5; x |= 0;
  return x | 0;
};

/** Renvoie un entier dans [0, max) et le nouvel état du générateur. */
export const rngInt = (s: number, max: number): [number, number] => {
  const n = nextRng(s);
  return [Math.abs(n) % max, n];
};

export const rollDie = (s: number): [number, number] => {
  const [v, n] = rngInt(s, 6);
  return [v + 1, n];
};

/** Mélange de Fisher-Yates piloté par le PRNG de la partie. */
export const shuffle = <T>(arr: readonly T[], seed: number): [T[], number] => {
  const out = arr.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, n] = rngInt(s, i + 1);
    s = n;
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return [out, s];
};

export const seedFromString = (str: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
};
