import { useState } from 'react';
import { useRoom, type NetMode } from '../net/room';
import { supabaseConfigured } from '../net/supabaseTransport';
import { audio } from '../audio/audio';
import { Icon } from './Icon';
import './Home.css';

const FACTS = [
  { icon: 'globe' as const, label: '22 villes, 8 groupes' },
  { icon: 'users' as const, label: '2 à 6 joueurs en temps réel' },
  { icon: 'building' as const, label: 'Maison → Villa → Grand Hôtel' },
  { icon: 'card' as const, label: '49 cartes évènement' },
];

export const Home = () => {
  const { identity, setIdentity, createRoom, joinRoom, connecting, error } = useRoom();
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<NetMode>(supabaseConfigured ? 'supabase' : 'local');
  const name = identity.name;

  const go = (fn: () => void) => { audio.unlock(); audio.click(); fn(); };

  return (
    <div className="home">
      <div className="home__sky" aria-hidden="true" />
      <div className="home__grid" aria-hidden="true" />
      <div className="home__orbit" style={{ width: 620, height: 620 }} aria-hidden="true" />
      <div className="home__orbit" style={{ width: 880, height: 880, animationDuration: '96s', animationDirection: 'reverse' }} aria-hidden="true" />

      <div className="home__inner">
        <header>
          <span className="home__eyebrow"><Icon name="spark" size={14} /> Jeu de plateau en ligne</span>
          <h1 className="home__title">
            <span>ATLAS</span>
            <span>ROYALE</span>
            <span>Bâtissez le monde</span>
          </h1>
          <p className="home__lead">
            Parcourez un plateau vivant de vingt-quatre métropoles. Achetez des villes,
            réunissez des groupes, faites monter vos quartiers de la maison au grand hôtel
            — et ruinez vos adversaires avant qu’ils ne vous ruinent.
          </p>
          <div className="home__facts">
            {FACTS.map((f) => (
              <span className="chip" key={f.label}><Icon name={f.icon} size={14} /> {f.label}</span>
            ))}
          </div>
        </header>

        <section className="panel home__card">
          <label className="label" htmlFor="pseudo">Votre pseudo</label>
          <input
            id="pseudo"
            className="input"
            maxLength={16}
            placeholder="Ex. Alexandra"
            value={name}
            onChange={(e) => setIdentity({ name: e.target.value })}
          />

          <button
            className="btn btn--accent btn--lg btn--block"
            style={{ marginTop: 'var(--sp-4)' }}
            disabled={!name.trim() || connecting}
            onClick={() => go(() => void createRoom(mode))}
          >
            <Icon name="spark" size={18} /> Créer une partie
          </button>

          <div className="home__sep">ou rejoindre</div>

          <label className="label" htmlFor="code">Code du salon</label>
          <div className="home__join">
            <input
              id="code"
              className="input"
              maxLength={5}
              placeholder="ABCDE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.length === 5 && name.trim()) go(() => void joinRoom(code, mode));
              }}
            />
            <button
              className="btn btn--primary"
              disabled={code.trim().length < 4 || !name.trim() || connecting}
              onClick={() => go(() => void joinRoom(code, mode))}
              aria-label="Rejoindre le salon"
            >
              <Icon name="chevron" size={18} />
            </button>
          </div>

          {error && <div className="home__err" role="alert">{error}</div>}

          <div className="home__mode">
            <span>
              <Icon name="link" size={13} style={{ verticalAlign: '-2px' }} />{' '}
              {mode === 'supabase' ? 'Serveur temps réel' : 'Réseau local (onglets de cet appareil)'}
            </span>
            {supabaseConfigured && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setMode((m) => (m === 'local' ? 'supabase' : 'local'))}
              >
                Changer
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
