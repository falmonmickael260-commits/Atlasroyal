import { useState } from 'react';
import { useRoom, type NetMode } from '../net/room';
import { supabaseConfigured } from '../net/supabaseTransport';
import { audio } from '../audio/audio';
import { Icon, type IconName } from './Icon';
import { Rules } from './Rules';
import './Home.css';

/**
 * Menu d'accueil.
 *
 * Deux entrées seulement ouvrent une partie — créer, ou rejoindre par code —
 * mais le menu en annonce davantage : classement, boutique, statistiques,
 * succès. Ces fonctions n'existent pas encore. Plutôt que de les masquer ou,
 * pire, de les laisser cliquables sans rien derrière, elles sont affichées et
 * marquées **Bientôt** : la promesse reste lisible, et le joueur n'essaie pas
 * une porte fermée.
 */

type Feuille = 'jouer' | 'regles' | 'options' | null;

/** Entrées principales, dans l'ordre d'importance. */
const PRINCIPALES: {
  cle: string; icone: IconName; titre: string; detail: string; teinte: string; action: Feuille | 'privee';
}[] = [
  { cle: 'jouer', icone: 'play', titre: 'Jouer', detail: 'Créer une partie ou rejoindre', teinte: 'or', action: 'jouer' },
  { cle: 'rapide', icone: 'users', titre: 'Partie rapide', detail: 'Rejoindre une partie aléatoire', teinte: 'azur', action: null },
  { cle: 'privee', icone: 'globe', titre: 'Partie privée', detail: 'Créer une partie avec un code', teinte: 'vert', action: 'privee' },
  { cle: 'regles', icone: 'school', titre: 'Règles', detail: 'Apprendre à jouer', teinte: 'violet', action: 'regles' },
];

/** Tuiles du bas. Seules les options sont branchées pour l'instant. */
const TUILES: { cle: string; icone: IconName; titre: string; ouvre: Feuille }[] = [
  { cle: 'classement', icone: 'podium', titre: 'Classement', ouvre: null },
  { cle: 'boutique', icone: 'cart', titre: 'Boutique', ouvre: null },
  { cle: 'stats', icone: 'chart', titre: 'Statistiques', ouvre: null },
  { cle: 'succes', icone: 'star', titre: 'Succès', ouvre: null },
  { cle: 'options', icone: 'gear', titre: 'Options', ouvre: 'options' },
];

export const Home = () => {
  const { identity, setIdentity, createRoom, joinRoom, connecting, error } = useRoom();
  const [feuille, setFeuille] = useState<Feuille>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<NetMode>(supabaseConfigured ? 'supabase' : 'local');
  const [sfx, setSfx] = useState(audio.sfxOn);
  const [musique, setMusique] = useState(audio.musicOn);
  const nom = identity.name;

  // Le premier geste du joueur débloque le son : la politique de lecture
  // automatique des navigateurs l'exige, et c'est le seul endroit sûr.
  const go = (fn: () => void) => { audio.unlock(); audio.click(); fn(); };

  const lancer = (cible: Feuille | 'privee') => {
    if (cible === 'privee') {
      // Sans pseudo, on ne peut pas créer : on ouvre la feuille qui le demande.
      if (!nom.trim()) { setFeuille('jouer'); return; }
      void createRoom(mode);
      return;
    }
    setFeuille(cible);
  };

  return (
    <div className="menu">
      <div className="menu__fond" aria-hidden="true" />
      <div className="menu__voile" aria-hidden="true" />

      <header className="menu__barre">
        <button className="profil" onClick={() => go(() => setFeuille('jouer'))}>
          <span className="profil__pastille" aria-hidden="true"><Icon name="crown" size={18} /></span>
          <span className="profil__texte">
            <span className="profil__nom">{nom.trim() || 'Choisir un pseudo'}</span>
            <span className="profil__sous">Appuyez pour modifier</span>
          </span>
        </button>

        <div className="menu__outils">
          <button
            className="rond" aria-pressed={sfx} aria-label="Effets sonores"
            onClick={() => go(() => { audio.setSfx(!sfx); setSfx(!sfx); })}
          >
            <Icon name={sfx ? 'sound' : 'mute'} size={18} />
          </button>
          <button
            className="rond" aria-pressed={musique} aria-label="Musique"
            onClick={() => go(() => { audio.setMusic(!musique); setMusique(!musique); })}
          >
            <Icon name="music" size={18} />
          </button>
          <button className="rond" aria-label="Règles" onClick={() => go(() => setFeuille('regles'))}>
            <Icon name="school" size={18} />
          </button>
        </div>
      </header>

      <div className="menu__corps">
        <img className="menu__logo" src={`${import.meta.env.BASE_URL}ui/logo.webp`} alt="Fortune City" />

        <nav className="menu__principal">
          {PRINCIPALES.map((e) => (
            <button
              key={e.cle}
              className={`entree entree--${e.teinte}`}
              disabled={e.action === null || connecting}
              onClick={() => go(() => lancer(e.action))}
            >
              <span className="entree__icone"><Icon name={e.icone} size={22} /></span>
              <span className="entree__texte">
                <span className="entree__titre">{e.titre}</span>
                <span className="entree__detail">{e.detail}</span>
              </span>
              {e.action === null && <span className="bientot">Bientôt</span>}
            </button>
          ))}
        </nav>

        {error && <div className="menu__erreur" role="alert">{error}</div>}

        <div className="menu__tuiles">
          {TUILES.map((t) => (
            <button
              key={t.cle}
              className="tuile"
              disabled={t.ouvre === null}
              onClick={() => go(() => setFeuille(t.ouvre))}
            >
              <Icon name={t.icone} size={20} />
              <span>{t.titre}</span>
              {t.ouvre === null && <span className="bientot bientot--tuile">bientôt</span>}
            </button>
          ))}
        </div>
      </div>

      {feuille && (
        <div className="voile" role="dialog" aria-modal="true" onClick={() => setFeuille(null)}>
          <div className="feuille" onClick={(ev) => ev.stopPropagation()}>
            <button className="feuille__fermer" aria-label="Fermer" onClick={() => go(() => setFeuille(null))}>
              <Icon name="close" size={18} />
            </button>

            {feuille === 'jouer' && (
              <>
                <h2 className="feuille__titre">Entrer en partie</h2>
                <label className="label" htmlFor="pseudo">Votre pseudo</label>
                <input
                  id="pseudo" className="input" maxLength={16} placeholder="Ex. Alexandra"
                  value={nom} onChange={(e) => setIdentity({ name: e.target.value })}
                />
                <button
                  className="btn btn--accent btn--lg btn--block" style={{ marginTop: 'var(--sp-4)' }}
                  disabled={!nom.trim() || connecting}
                  onClick={() => go(() => void createRoom(mode))}
                >
                  <Icon name="spark" size={18} /> Créer une partie
                </button>

                <div className="feuille__sep">ou rejoindre</div>

                <label className="label" htmlFor="code">Code du salon</label>
                <div className="feuille__join">
                  <input
                    id="code" className="input" maxLength={5} placeholder="ABCDE" value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && code.length === 5 && nom.trim()) go(() => void joinRoom(code, mode));
                    }}
                  />
                  <button
                    className="btn btn--primary" aria-label="Rejoindre le salon"
                    disabled={code.trim().length < 4 || !nom.trim() || connecting}
                    onClick={() => go(() => void joinRoom(code, mode))}
                  >
                    <Icon name="chevron" size={18} />
                  </button>
                </div>
              </>
            )}

            {feuille === 'regles' && <Rules />}

            {feuille === 'options' && (
              <>
                <h2 className="feuille__titre">Options</h2>
                <div className="option">
                  <span>Effets sonores</span>
                  <button className="btn btn--sm" onClick={() => go(() => { audio.setSfx(!sfx); setSfx(!sfx); })}>
                    {sfx ? 'Activés' : 'Coupés'}
                  </button>
                </div>
                <div className="option">
                  <span>Musique</span>
                  <button className="btn btn--sm" onClick={() => go(() => { audio.setMusic(!musique); setMusique(!musique); })}>
                    {musique ? 'Activée' : 'Coupée'}
                  </button>
                </div>
                <div className="option">
                  <span>
                    Connexion
                    <small>{mode === 'supabase' ? 'Serveur temps réel' : 'Onglets de cet appareil'}</small>
                  </span>
                  <button
                    className="btn btn--sm" disabled={!supabaseConfigured}
                    onClick={() => setMode((m) => (m === 'local' ? 'supabase' : 'local'))}
                  >
                    Changer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
