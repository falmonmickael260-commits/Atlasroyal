import { Icon } from '../Icon';
import { cardOf } from '../cinema';

const TONE: Record<string, { bg: string; fg: string; ring: string }> = {
  positif: { bg: 'linear-gradient(165deg,#14532D,#052E16)', fg: '#86EFAC', ring: '#22C55E' },
  negatif: { bg: 'linear-gradient(165deg,#7F1D1D,#2A0A0A)', fg: '#FCA5A5', ring: '#DC2626' },
  neutre:  { bg: 'linear-gradient(165deg,#1E293B,#0B1220)', fg: '#CBD5E1', ring: '#64748B' },
  chaos:   { bg: 'linear-gradient(165deg,#4C1D95,#1E1035)', fg: '#D8B4FE', ring: '#A855F7' },
};

const RARITY: Record<string, string> = {
  commune: 'Commune', rare: 'Rare', legendaire: 'Légendaire',
};

/** Tirage de carte : plan serré, retournement 3D, révélation. */
export const CardOverlay = ({ cardId }: { cardId: string | null }) => {
  const card = cardOf(cardId);
  if (!card) return null;
  const tone = TONE[card.tone] ?? TONE.neutre;

  return (
    <div className="cardfx">
      <div className="cardfx__card">
        <div className="cardfx__face" style={{ background: tone.bg }}>
          <div className="cardfx__deck" style={{ color: tone.fg }}>
            {card.deck === 'destin' ? 'Carte Destin' : 'Carte Marché'}
          </div>
          <div className="cardfx__seal" style={{ color: tone.fg }}>
            <Icon name={card.deck === 'destin' ? 'spark' : 'coins'} size={24} />
          </div>
          <div className="cardfx__title">{card.title}</div>
          <div className="cardfx__text">{card.text}</div>
          <div className="cardfx__rarity" style={{ color: tone.fg }}>
            {RARITY[card.rarity]}
          </div>
        </div>
      </div>
    </div>
  );
};
