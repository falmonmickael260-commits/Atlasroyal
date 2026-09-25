import { useState } from 'react';
import { useRoom } from '../net/room';
import { AVATARS, COLORS, TOKENS } from '../net/protocol';
import { RULES } from '../engine/board';
import { audio } from '../audio/audio';
import { Icon } from './Icon';
import './Lobby.css';

const avatarIcon = (id: string) =>
  ({ a1: 'globe', a2: 'hammer', a3: 'plane', a4: 'bank', a5: 'eye', a6: 'building' } as const)[id as 'a1'] ?? 'globe';

export const Lobby = () => {
  const { lobby, identity, isHost, setIdentity, setReady, startGame, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);
  if (!lobby) return null;

  const me = lobby.seats.find((s) => s.id === identity.id);
  const allReady = lobby.seats.length >= RULES.minPlayers && lobby.seats.every((s) => s.ready);
  const empties = Math.max(0, RULES.maxPlayers - lobby.seats.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lobby.roomCode);
      setCopied(true);
      audio.click();
      setTimeout(() => setCopied(false), 1800);
    } catch { /* presse-papier refusé : le code reste lisible à l'écran */ }
  };

  const takenColor = (c: string) => lobby.seats.some((s) => s.id !== identity.id && s.color === c);
  const takenToken = (t: string) => lobby.seats.some((s) => s.id !== identity.id && s.token === t);

  return (
    <div className="lobby">
      <div className="lobby__bg" aria-hidden="true" />
      <div className="lobby__inner">
        <div className="lobby__head">
          <div>
            <span className="home__eyebrow"><Icon name="users" size={14} /> Salon</span>
            <h1 style={{ fontSize: 40, marginTop: 12 }}>Préparez l’expédition</h1>
          </div>
          <div className="lobby__code">
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Code à partager</div>
              <strong>{lobby.roomCode}</strong>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={copy} aria-label="Copier le code">
              <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>

        <div className="seats">
          {lobby.seats.map((s) => {
            const mine = s.id === identity.id;
            return (
              <div
                key={s.id}
                className={`seat${mine ? ' seat--me' : ''}${s.ready ? ' seat--ready' : ''}`}
                style={{ ['--seat-color' as string]: s.color }}
              >
                <div className="seat__top">
                  <span className="seat__badge"><Icon name={avatarIcon(s.avatar)} size={22} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="seat__name">{s.name || 'Joueur'}{s.host && ' · hôte'}</div>
                    <div className="seat__meta">
                      {TOKENS.find((t) => t.id === s.token)?.label}
                      {!s.connected && <span className="seat__off"> · hors ligne</span>}
                    </div>
                  </div>
                </div>

                {mine && (
                  <>
                    <div className="picker" role="group" aria-label="Couleur">
                      {COLORS.map((c) => (
                        <button
                          key={c} className="swatch" style={{ background: c }}
                          aria-label={`Couleur ${c}`}
                          aria-pressed={s.color === c}
                          disabled={takenColor(c)}
                          onClick={() => { audio.click(); setIdentity({ color: c }); }}
                        />
                      ))}
                    </div>
                    <div className="picker" role="group" aria-label="Avatar">
                      {AVATARS.map((a) => (
                        <button
                          key={a.id} className="pill-opt" aria-pressed={s.avatar === a.id}
                          onClick={() => { audio.click(); setIdentity({ avatar: a.id }); }}
                        >{a.label}</button>
                      ))}
                    </div>
                    <div className="picker" role="group" aria-label="Pion">
                      {TOKENS.map((t) => (
                        <button
                          key={t.id} className="pill-opt" aria-pressed={s.token === t.id}
                          disabled={takenToken(t.id)}
                          onClick={() => { audio.click(); setIdentity({ token: t.id }); }}
                        >{t.label}</button>
                      ))}
                    </div>
                  </>
                )}

                <div className={`seat__status ${s.ready ? 'seat__status--ready' : 'seat__status--wait'}`}>
                  <Icon name={s.ready ? 'check' : 'minus'} size={14} />
                  {s.ready ? 'Prêt' : 'En attente'}
                </div>
              </div>
            );
          })}

          {Array.from({ length: empties }, (_, i) => (
            <div className="seat seat--empty" key={`e${i}`}>
              <div style={{ textAlign: 'center' }}>
                <Icon name="plus" size={22} />
                <div style={{ fontSize: 12, marginTop: 8 }}>Siège libre</div>
              </div>
            </div>
          ))}
        </div>

        <div className="lobby__foot">
          <p className="lobby__hint">
            {isHost
              ? 'Partagez le code : les joueurs vous rejoignent depuis l’écran d’accueil. La partie démarre quand tout le monde est prêt.'
              : 'Signalez-vous prêt. L’hôte lancera la partie.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn--ghost" onClick={leaveRoom}>
              <Icon name="exit" size={16} /> Quitter
            </button>
            <button
              className={`btn ${me?.ready ? 'btn--ghost' : 'btn--primary'}`}
              onClick={() => { audio.unlock(); audio.click(); setReady(!me?.ready); }}
            >
              <Icon name="check" size={16} /> {me?.ready ? 'Annuler' : 'Je suis prêt'}
            </button>
            {isHost && (
              <button className="btn btn--accent btn--lg" disabled={!allReady} onClick={() => { audio.click(); startGame(); }}>
                <Icon name="dice" size={18} /> Lancer la partie
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
