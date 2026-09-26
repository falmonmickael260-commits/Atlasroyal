# ATLAS ROYALE

Jeu de plateau multijoueur en ligne, 2 à 6 joueurs. Univers, plateau, villes,
cartes, pions et identité visuelle originaux ; mécaniques d'acquisition, de
loyers et de construction du genre « immobilier de plateau ».

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5174)
npm test         # suite de tests du moteur
npm run check    # vérification TypeScript
npm run build    # build de production -> dist/
```

Pour jouer à plusieurs immédiatement : ouvrez l'URL dans plusieurs onglets (ou
plusieurs navigateurs de la même machine). Un onglet crée la partie, les autres
la rejoignent avec le code à 5 caractères. Chaque onglet a sa propre identité.

---

## 1. Le jeu

Vingt-deux métropoles en **huit groupes** : six de trois villes, encadrés par
deux groupes de deux — le moins cher et le plus cher, qui se réunissent vite.
Quatre hubs régulièrement répartis (cases 5, 15, 25, 35), six cases carte.
On achète des villes, on réunit un groupe complet, puis on bâtit :

```
Terrain nu  →  Maison  →  Villa  →  Grand Hôtel
```

Le dernier joueur financièrement viable gagne.

### Règles appliquées

| Règle | Valeur |
|---|---|
| Fortune de départ | 35 000 € |
| Passage par le Départ | +200 € |
| Arrivée exacte sur le Départ | +400 € (animation distincte) |
| Premier tour de table | aucun achat possible |
| Double | le joueur rejoue |
| Trois doubles consécutifs | prison immédiate, pas de quatrième lancer |
| Sortie de prison | 50 €, ou un double, avec 3 tentatives maximum |
| Après 3 tentatives ratées | caution de 50 € obligatoire, puis déplacement |
| Taxes, impôts, cautions | versés à la cagnotte centrale |
| Parc Gratuit | le joueur encaisse **100 %** de la cagnotte |
| Construction | uniquement avec toutes les villes du groupe, et de façon homogène |
| Hypothèque | 50 % du prix ; levée à 110 % de ce montant |
| Revente d'un niveau | 50 % du coût de construction |
| Échanges | propriétés et liquidités dans les deux sens, à accepter ou refuser |
| Faillite | patrimoine transféré au créancier, joueur éliminé |

Prix des villes : 900 € (Marrakech) à 4 500 € (Monaco). Loyers indexés sur le
prix, multipliés par 5 / 14 / 26 selon le niveau de construction. Un Grand Hôtel
à Monaco coûte 7 800 € au visiteur.

**Choix assumés** — deux points s'écartent des habitudes du genre, à la demande
du cahier des charges : une propriété refusée reste simplement disponible (pas
d'enchère), et la caution de sortie de prison reste à 50 € alors que l'échelle
monétaire du reste du jeu est dix fois supérieure. Les deux sont regroupés dans
`RULES` (`src/engine/board.ts`) et se changent en une ligne.

---

## 2. Architecture

```
intention (client)  ──►  autorité  ──►  { état, évènements[] }
                                              │
                      instantané d'état ◄─────┤
                      mise en scène     ◄─────┘
```

| Dossier | Rôle |
|---|---|
| `src/engine/` | Règles, plateau, cartes, machine à états. **TypeScript pur, testé.** |
| `src/net/` | Protocole, transports temps réel, autorité, reconnexion. |
| `src/board3d/` | Rendu three.js / React Three Fiber. |
| `src/ui/` | Accueil, salon, HUD, panneaux, victoire. |
| `src/audio/` | Effets sonores synthétisés (aucun fichier audio). |
| `src/cinematic/` | Générique Remotion. |

### Le moteur est pur et déterministe

`applyCommand(state, cmd) -> { state, events }` n'a aucune dépendance React ou
DOM et n'appelle jamais `Math.random()` : l'aléatoire vient d'un PRNG seedé
**stocké dans l'état**. Rejouer la même suite de commandes reproduit exactement
la même partie — propriété vérifiée par les tests.

### Le client ne décide de rien

Un client n'émet que des **intentions**. Il ne calcule ni un dé, ni un solde, ni
un loyer, ni un transfert. Il reçoit un état et une liste d'évènements ordonnés,
et se contente de jouer l'animation correspondante (`src/ui/cinema.ts`). Toute
commande est refusée si elle ne vient pas du joueur attendu dans la phase
attendue. Un client qui modifierait son état local serait écrasé au prochain
instantané.

### Machine à états

```
LOBBY → GAME_START → ROLL_DICE ⇄ DICE_RESULT → MOVING → LANDING
          ↓                                                │
     PROPERTY_DECISION ─┬─► PAYMENT ─┐                     │
     CARD_EVENT ────────┤            ├─► DEBT_RESOLUTION ──┴─► BANKRUPTCY
     JAIL ──────────────┘            │
                                     └─► NEXT_PLAYER → GAME_OVER
```

`pending` décrit la décision attendue et de qui : c'est ce qui permet de
suspendre la partie sur un achat, un choix de prison ou une dette.

---

## 3. Temps réel

Deux transports derrière une même interface (`src/net/transport.ts`) :

- **`LocalTransport`** (`BroadcastChannel`) — plusieurs onglets d'une même
  machine. Actif par défaut, sans aucune configuration.
- **`SupabaseTransport`** (Supabase Realtime) — parties entre appareils.
  Aucune table n'est nécessaire : tout passe par un canal de diffusion.

```bash
cp .env.example .env.local   # puis renseignez vos deux valeurs
```

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
```

L'option apparaît alors sur l'écran d'accueil.

**Modèle d'autorité, sans détour :** l'hôte fait autorité. Le moteur étant pur
et déjà isolé de tout code navigateur, le déporter dans une Edge Function
Supabase ne demande qu'un adaptateur — c'est ce qui rendrait l'autorité
réellement indépendante des joueurs. En l'état, un hôte malveillant pourrait
manipuler la partie ; les autres joueurs, non.

### Reconnexion

L'identifiant de joueur vit dans `sessionStorage` : il est propre à l'onglet
(donc plusieurs joueurs sur une machine) et survit à un rafraîchissement. À la
reconnexion, l'hôte retrouve le siège et renvoie l'état complet. Le profil
(pseudo, avatar, couleur) vit dans `localStorage` et n'est pas à ressaisir.

---

## 4. Rendu

Le jeu est posé sur une table, dans une pièce. Murs, sol, tapis, bibliothèque,
plante, lampe : **tout le décor est strictement immobile**. La caméra ne suit
jamais un pion, ne zoome pas, ne dérive pas. Seuls s'animent les objets du
jeu — dés, pions, constructions, cartes, argent, échanges.

Le cadrage n'est pas estimé mais **mesuré** : la caméra projette les quatre
coins du plateau et recule jusqu'à ce qu'ils tiennent tous, en réservant la
place des panneaux d'interface. Un plateau vu de biais se projette de façon
asymétrique, et une formule fondée sur la distance au centre le coupe sur les
côtés (`FixedCamera.tsx`).

- Les faces de cases sont **peintes au Canvas 2D** puis uploadées en texture :
  pas de police 3D à charger, typographie nette, zéro requête réseau. La
  densité est de 256 px par unité monde (160 sur mobile), avec filtrage
  anisotrope maximal — c'est lui qui sauve la lisibilité en vue oblique.
- Le rendu suit la **densité réelle de l'écran** (jusqu'à 2×), avec
  antialiasing et ombres douces. `AdaptiveQuality` mesure la cadence après une
  seconde et allège par paliers si la machine ne suit pas.
- Les prénoms des joueurs sont rendus en **DOM**, positionnés chaque image par
  projection de la position du pion : le texte reste net quel que soit l'angle.
- Les effets sonores sont **synthétisés** (WebAudio) : aucun asset binaire.
- `prefers-reduced-motion` raccourcit les mises en scène au lieu de les couper.
- three.js n'est chargé qu'à l'entrée en partie (accueil : ~77 ko gzip).

---

## 5. Générique Remotion

La composition `src/cinematic/AtlasIntro.tsx` sert **à la fois** de séquence
d'ouverture dans le jeu (via `@remotion/player`, passable par Échap) et de
source d'export vidéo :

```bash
npm run intro:studio     # Remotion Studio
npm run intro:render     # -> out/atlas-intro.mp4
```

Elle charge ses propres polices (`@remotion/google-fonts`), donc le rendu MP4 ne
dépend pas de la feuille de style de la page.

---

## 6. Tests

```bash
npm test
```

66 tests. Outre les règles unitaires (barèmes, doubles, prison, hypothèques,
échanges, faillite, anti-triche), la suite joue des **parties complètes de 2 à 6
joueurs** pilotées par un bot qui ne passe que par des commandes publiques
(`src/engine/__tests__/bot.ts`). Toute phase sans coup jouable lève une
exception : c'est le test anti-blocage. Les invariants comptables sont vérifiés
sur dix parties (aucun solde négatif, aucune case orpheline, un seul survivant).
