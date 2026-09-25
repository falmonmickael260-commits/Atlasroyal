import { useEffect } from 'react';
import { useRoom } from '../net/room';
import { Icon } from './Icon';

/** Retour d'erreur venant de l'autorité (commande refusée). */
export const Toast = () => {
  const { toast, clearToast } = useRoom();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 3200);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 90,
        padding: '12px 18px', borderRadius: 'var(--r-pill)',
        background: 'rgba(220,38,38,.18)', border: '1px solid rgba(220,38,38,.5)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        color: '#FECACA', fontSize: 14, maxWidth: 'min(92vw, 460px)',
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <Icon name="shield" size={16} /> {toast}
    </div>
  );
};
