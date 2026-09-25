import type { Banner } from '../cinema';
import { signed } from '../format';

/** Titrage plein écran des évènements marquants. */
export const BannerLayer = ({ banner }: { banner: Banner | null }) => {
  if (!banner) return null;
  const big = banner.kind === 'exact-go' || banner.kind === 'jackpot' || banner.kind === 'bankrupt';
  return (
    <div className="banner" key={banner.key} role="status" aria-live="polite">
      <div
        className="banner__title"
        style={{ color: banner.color ?? '#F8FAFC', fontSize: big ? 'clamp(38px, 7vw, 76px)' : undefined }}
      >
        {banner.title}
      </div>
      {banner.detail && <div className="banner__detail">{banner.detail}</div>}
      {banner.amount !== undefined && (
        <div className="banner__amount" style={{ color: banner.amount >= 0 ? 'var(--success)' : 'var(--danger-lift)' }}>
          {signed(banner.amount)}
        </div>
      )}
    </div>
  );
};
