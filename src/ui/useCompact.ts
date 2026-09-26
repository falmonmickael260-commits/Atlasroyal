import { useEffect, useState } from 'react';

/** Vrai en dessous de 860 px : bascule la mise en page vers le mode compact. */
export const useCompact = () => {
  const [compact, setCompact] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 860px)').matches,
  );
  useEffect(() => {
    const mq = matchMedia('(max-width: 860px)');
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
};

/**
 * Niveau de rendu initial.
 *
 * On vise délibérément la qualité maximale : le nombre de cœurs est un
 * mauvais indicateur de puissance graphique (un navigateur intégré peut en
 * annoncer quatre sur une machine qui en a huit), et s'y fier privait la
 * scène de ses ombres et de sa résolution sans raison. C'est `AdaptiveQuality`
 * qui allège, à partir de la cadence réellement mesurée.
 *
 * Seule exception : un utilisateur qui demande explicitement moins
 * d'animation démarre d'emblée en mode léger.
 */
export const useQuality = (): 'high' | 'low' => {
  const [q, setQ] = useState<'high' | 'low'>('high');
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setQ('low');
  }, []);
  return q;
};
