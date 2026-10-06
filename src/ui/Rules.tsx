import { RULES, LEVEL_NAMES } from '../engine/board';
import { euro } from './format';

/**
 * Règles du jeu, lues depuis le moteur plutôt que recopiées.
 *
 * Les montants affichés ici sont ceux que l'arbitre applique réellement :
 * une page de règles écrite à la main se désynchronise au premier
 * rééquilibrage, et c'est alors elle qu'on croit.
 */
const LIGNES: [string, string][] = [
  ['Fortune de départ', euro(RULES.startingCash)],
  ['Passage par le Départ', `+${euro(RULES.passGo)}`],
  ['Arrivée exacte sur le Départ', `+${euro(RULES.exactGo)}`],
  ['Premier tour de table', 'aucun achat possible'],
  ['Double', 'le joueur rejoue'],
  ['Trois doubles de suite', 'prison immédiate'],
  ['Sortie de prison', `${euro(RULES.jailFine)}, ou un double, ${RULES.jailMaxAttempts} tentatives`],
  ['Taxes et cautions', 'versées à la cagnotte centrale'],
  ['Parc Gratuit', '100 % de la cagnotte pour qui s’y arrête'],
  ['Construction', 'groupe complet, et de façon homogène'],
  ['Hypothèque', `${Math.round(RULES.mortgageRate * 100)} % du prix, levée à ${Math.round(RULES.unmortgageRate * 100)} %`],
  ['Revente d’un niveau', `${Math.round(RULES.sellBuildingRate * 100)} % du coût`],
  ['Échange', 'une contrepartie exigée de chaque côté'],
  ['Faillite', 'patrimoine transféré au créancier'],
];

export const Rules = () => (
  <>
    <h2 className="feuille__titre">Comment on joue</h2>
    <p className="regles__intro">
      Vingt-deux métropoles, huit groupes de couleur. On achète des villes, on réunit
      un groupe entier, puis on bâtit — et chaque palier multiplie le loyer.
    </p>
    <div className="regles__paliers">
      {LEVEL_NAMES.map((n, i) => (
        <span key={n} className="chip">{i === 0 ? n : `${i} · ${n}`}</span>
      ))}
    </div>
    <dl className="regles">
      {LIGNES.map(([quoi, valeur]) => (
        <div key={quoi}>
          <dt>{quoi}</dt>
          <dd>{valeur}</dd>
        </div>
      ))}
    </dl>
    <p className="regles__fin">Le dernier joueur financièrement viable gagne.</p>
  </>
);
