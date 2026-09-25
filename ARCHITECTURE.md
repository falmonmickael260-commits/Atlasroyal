# ATLAS ROYALE — Architecture

Jeu de plateau multijoueur en ligne, univers original (villes internationales),
mécaniques d'acquisition/loyer/construction inspirées du genre.

## Principe directeur : moteur pur + flux d'évènements

    intent (client)  ──►  autorité (hôte/serveur)  ──►  { state, events[] }
                                                              │
                             snapshot état ◄─────────────────┤
                             timeline cinématique ◄──────────┘

- `engine/` est **pur et déterministe**. Aucune dépendance React/DOM.
  `applyCommand(state, cmd) -> { state, events }`. Tout l'aléatoire vient
  d'un PRNG seedé **stocké dans l'état** (`rng`), jamais de `Math.random()`.
- Le client n'envoie que des **intentions**. Il ne calcule jamais un dé, un
  solde, un loyer ou un transfert. Il reçoit un état + une liste d'évènements
  ordonnés et se contente de **jouer l'animation** correspondante.
- Un client qui triche sur son état local est écrasé au snapshot suivant :
  l'autorité ne lit jamais l'état du client.

## Couches

| Dossier      | Rôle                                                              |
|--------------|-------------------------------------------------------------------|
| `engine/`    | Règles, plateau, cartes, machine à états. Pur TS, testé.          |
| `net/`       | Protocole, transports (local multi-onglets / Supabase Realtime).   |
| `board3d/`   | Rendu three.js + R3F : plateau en relief, pions, dés, bâtiments.  |
| `ui/`        | Lobby, HUD, panneaux, échanges, victoire (glassmorphism).         |
| `audio/`     | Synthèse WebAudio (aucun asset binaire à charger).                |

## Machine à états

    LOBBY → GAME_START → ROLL_DICE ⇄ DICE_RESULT → MOVING → LANDING
              ↓                                                │
         PROPERTY_DECISION ─┬─► PAYMENT ─┐                     │
         CARD_EVENT ────────┤            ├─► DEBT_RESOLUTION ──┴─► BANKRUPTCY
         JAIL ──────────────┘            │
                                         └─► NEXT_PLAYER → (NEXT_ROUND) → GAME_OVER

`phase` vit dans l'état, `pending` décrit la décision attendue et de qui.
Toute commande est rejetée si elle ne vient pas du joueur attendu dans la
phase attendue (`guard()` dans `engine.ts`).

## Déterminisme

`rng` = xorshift32 seedé à la création de la partie. Le seed n'est **jamais**
envoyé aux clients — ils reçoivent les résultats, pas la source. Rejouer la
même liste de commandes sur le même seed reproduit exactement la partie
(propriété utilisée par les tests).

## Modèle d'autorité

- `LocalTransport` : l'hôte est autorité, diffusion via `BroadcastChannel`.
  Multi-onglets sur une machine — utilisable et testable immédiatement.
- `SupabaseTransport` : même interface sur Supabase Realtime (broadcast +
  presence). L'hôte reste autorité ; `supabase/` contient le schéma pour
  déporter l'autorité dans une Edge Function (autorité sans confiance).
