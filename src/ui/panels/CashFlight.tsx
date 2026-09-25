import { useEffect, useState } from 'react';
import type { CashFly } from '../cinema';
import { euro } from '../format';

interface Flight extends CashFly {
  from: string | null;
  to: string | null;
  x0: number; y0: number; x1: number; y1: number;
}

const anchor = (player: string | null): DOMRect | null => {
  const sel = player ? `[data-player="${player}"]` : '[data-pot]';
  return document.querySelector(sel)?.getBoundingClientRect() ?? null;
};

/**
 * L'argent traverse physiquement l'écran d'un joueur à l'autre (ou vers la
 * cagnotte) : on voit *qui* paie *qui*, sans avoir à lire un journal.
 * Les positions sont mesurées au moment du paiement, donc l'animation suit la
 * mise en page réelle, y compris en mobile où le rail est horizontal.
 */
export const CashFlight = ({ fly }: { fly: CashFly | null }) => {
  const [flight, setFlight] = useState<Flight | null>(null);

  useEffect(() => {
    if (!fly) return;
    const a = anchor(fly.from);
    const b = anchor(fly.to);
    if (!a || !b) return;
    setFlight({
      ...fly,
      x0: a.left + a.width / 2, y0: a.top + a.height / 2,
      x1: b.left + b.width / 2, y1: b.top + b.height / 2,
    });
    const id = setTimeout(() => setFlight(null), 1150);
    return () => clearTimeout(id);
  }, [fly]);

  if (!flight) return null;

  return (
    <div
      key={flight.key}
      data-cash-flight
      aria-hidden="true"
      style={{
        position: 'fixed', left: 0, top: 0, zIndex: 30, pointerEvents: 'none',
        // Les deux extrémités sont passées en variables : l'animation elle-même
        // est décrite une fois en CSS.
        ['--x0' as string]: `${flight.x0}px`,
        ['--y0' as string]: `${flight.y0}px`,
        ['--x1' as string]: `${flight.x1}px`,
        ['--y1' as string]: `${flight.y1}px`,
        animation: 'cash-fly 1.05s cubic-bezier(.4,0,.2,1) both',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          transform: 'translate(-50%, -50%)',
          padding: '6px 14px',
          borderRadius: 'var(--r-pill)',
          background: 'linear-gradient(140deg, #F59E0B, #D97706)',
          color: '#1A1205',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          whiteSpace: 'nowrap',
          boxShadow: '0 10px 28px rgba(217,119,6,.5)',
        }}
      >
        {euro(flight.amount)}
      </span>
    </div>
  );
};
