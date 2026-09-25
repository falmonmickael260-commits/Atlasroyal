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

/** Réduit la charge graphique sur les appareils modestes. */
export const useQuality = (): 'high' | 'low' => {
  const [q, setQ] = useState<'high' | 'low'>('high');
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mobile = matchMedia('(pointer: coarse)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setQ(cores <= 4 || (mobile && cores <= 6) || reduced ? 'low' : 'high');
  }, []);
  return q;
};
