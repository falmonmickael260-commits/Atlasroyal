# Fortune Empire

Le jeu complet conserve son moteur de règles d’origine. Les visuels Godot sont intégrés dans la partie via un rendu contrôlé par les instantanés du moteur : cartes, doubles, achats, loyers, maisons/hôtels et échanges restent gérés par `src/engine`.

Les salons entre appareils utilisent le serveur WebSocket de `server/index.mjs`. L’hôte garde sa page ouverte : son navigateur est l’autorité de la partie. Quitter ou recharger cet onglet ferme le salon. La caméra du plateau est fixe.

Déploiement Railway : racine `/`, `Dockerfile` racine, port `$PORT`, santé `/health`. Le conteneur sert le jeu principal et le rendu Godot sous `/godot/`. Le dossier Godot seul est un banc d’essai visuel, pas le jeu complet.

Pour vérifier : `npm test`, `npm run check`, `node --test server/*.test.mjs` et `godot --headless --path godot --script bridge_test.gd`. Pour lancer l’ensemble, utiliser le Dockerfile racine ; il compile également le rendu Godot requis par le jeu.

Les achats restent soumis à la règle d’origine : pas d’achat au premier tour de table, puis achats ouverts au deuxième. Les interfaces affichent cette condition.

Le logo illustré d’origine (`public/ui/logo.webp`) reste utilisé dans les menus et la partie. Les règles sont consultables depuis la partie. Le résultat des dés et la commande **Relancer — double !** rendent explicite le droit de rejouer après résolution de la case.

Le plateau se prépare dès le salon : le même cadre Godot est conservé lors du lancement. Les fichiers Web sont compressés en Brotli/gzip et portent une version issue de leur contenu pour éviter les mélanges de cache après publication. Les géométries immobiles sont regroupées ; les pions et éléments animés conservent leur hiérarchie.

## Interface de partie et échanges

Le comptoir des échanges présente les propriétés illustrées, leurs groupes et les hypothèques dans deux colonnes. Le récapitulatif, le solde prévu après accord et l’envoi restent visibles pendant le défilement. Les valeurs catalogue indiquent les prix d’achat, sans estimer la valeur stratégique des groupes.

Les offres reçues et envoyées disposent de vues dédiées. Le joueur peut accepter, refuser, retirer ou préparer une contre-proposition. Une contre-proposition reprend l’offre en sens inverse ; l’envoi refuse l’original puis propose le nouvel accord avec les commandes existantes. Les transferts restent effectués uniquement à l’acceptation par le moteur d’origine.

Le brouillon est conservé quand la fenêtre se ferme, pendant la partie en cours. Les propriétés construites sont désactivées ; une sélection devenue périmée doit être actualisée. Les refus du moteur conservent la proposition à corriger. L’interface gère le clavier, Échap et les petits écrans.

## Correctifs de stabilité

Les dettes conservent la suite des paiements et des effets de carte. Le règlement d’une caution obligatoire reprend la sortie de prison et le déplacement déjà tiré. Les cartes de travaux comptent chaque maison et chaque hôtel ; leurs montants affichés suivent les effets configurés. Une offre est de nouveau vérifiée à l’acceptation, et les commandes financières sont arrêtées après la victoire.

L’entrée dans un salon attend la confirmation de l’hôte et reste visible pendant la connexion. Les états d’une ancienne connexion sont effacés, la reprise évite les connexions concurrentes et les instantanés reçus deux fois ne rejouent pas leurs animations. Un invité conserve son code lors d’une coupure récupérable. Un battement WebSocket repère les connexions disparues ; un message mal formé ne doit pas arrêter les autres salons.

Un lancement répété ne recrée plus la partie. Le départ explicite de l’hôte annonce aussi la fermeture aux autres onglets en mode local. Si le contexte graphique disparaît après le chargement, la récupération relance uniquement le rendu du plateau et conserve la connexion de la partie.

## Documentation des règles d’origine

## Règles et fonctionnement

Jeu de plateau multijoueur en ligne, 2 à 8 joueurs. Univers, plateau, villes,
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
Terrain nu  →  1 maison  →  2  →  3  →  4 maisons  →  Hôtel
```

Le dernier joueur financièrement viable gagne.

### Règles appliquées

| Règle | Valeur |
|---|---|
| Fortune de départ | 2 500 € |
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
| Stock de bâtiments | **32 maisons et 12 hôtels** pour toute la table — quand la banque est vide, personne ne bâtit |
| Hypothèque | 50 % du prix ; levée à 110 % de ce montant |
| Revente d'un niveau | 50 % du coût de construction |
| Échanges | propriétés et liquidités dans les deux sens, à accepter ou refuser ; une contrepartie est exigée de chaque côté — pas de don déguisé |
| Faillite | patrimoine transféré au créancier, joueur éliminé |

### Échelle monétaire

| | |
|---|---|
| Fortune de départ | 2 500 € |
| Terrains | 60 € (Marrakech, Le Caire) à 400 € (Monaco) |
| Construction | 50 € à 200 € le palier selon le groupe, cinq paliers — l'hôtel s'atteint donc en cinq paiements |
| Hubs | 200 € — loyer 25 / 50 / 100 / 200 selon le nombre possédé |
| Réseaux | 150 € — loyer de 4 × ou 10 × la somme des dés |
| Loyers | de 2 € (terrain nu le moins cher) à 2 000 € (hôtel à Monaco) |

Les loyers ne sont pas calculés par formule : chaque ville porte sa propre
ligne de six valeurs. Une formule donnait des paliers réguliers, là où le
barème de référence accélère irrégulièrement — c'est précisément cette
irrégularité qui rend la troisième maison décisive et la quatrième presque
décevante. Marrakech : 2 / 10 / 30 / 90 / 160 / 250 pour 60 € d'achat et 50 €
le palier.

L'échelle précédente était **incohérente avec elle-même** : on démarrait à
35 000 €, une ville en coûtait 900 à 4 500 — mais le passage par le Départ
rapportait 200 € et la caution de prison 50 €. Deux valeurs étaient restées sur
l'échelle classique du genre pendant que tout le reste était multiplié par
vingt-trois. Conséquence : faire le tour du plateau ne rapportait rien, la
prison ne coûtait rien, et l'argent n'avait plus de sens relatif.

Tout est désormais ramené sur la même base — celle, éprouvée, où un tour de
plateau paie environ un huitième d'une rue moyenne. Les montants des cartes
suivent la même échelle (10 € à 85 €) : une carte pèse sur un tour sans jamais
régler la partie.

**Choix assumés** — un point s'écarte des habitudes du genre, à la demande du
cahier des charges : une propriété refusée reste simplement disponible, sans
enchère. Arriver pile sur le Départ double la prime (+400 € au lieu de +200 €)
est l'autre écart, celui-là volontaire. Les deux sont dans `RULES`
(`src/engine/board.ts`) et se changent en une ligne.

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

La composition `src/cinematic/FortuneIntro.tsx` sert **à la fois** de séquence
d'ouverture dans le jeu (via `@remotion/player`, passable par Échap) et de
source d'export vidéo :

```bash
npm run intro:studio     # Remotion Studio
npm run intro:render     # -> out/fortune-intro.mp4
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
