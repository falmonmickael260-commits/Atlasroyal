# FORTUNE CITY — fiche de fabrication du plateau

Document de référence pour la conception graphique. Tous les chiffres
proviennent directement du moteur de jeu : toute divergence entre cette
fiche et le plateau imprimé se verra en partie.

## Sens de lecture

40 cases numérotées de 0 à 39, **dans le sens anti-horaire** depuis la case
Départ, située en **bas à droite**. Les cases 0, 10, 20 et 30 sont les quatre
coins. Chaque côté compte neuf cases entre deux coins.

- Case bord : rapport **2,05 × 2,9** (plus haute que large)
- Case coin : **2,9 × 2,9** (carrée)
- Côté complet : 2 coins + 9 cases = **24,25** unités
- Une case de bord occupe donc **8,5 %** de la largeur du plateau

Le bandeau de couleur du groupe se place **côté intérieur** de la case,
sur environ 20 % de sa hauteur. Le nom et le prix occupent le reste.

## Les huit groupes

| Groupe | Couleur | Villes |
|---|---|---|
| Terre | `#8B5A3C` | Marrakech, Le Caire |
| Azur | `#38BDF8` | Bangkok, Hanoï, Bali |
| Fuchsia | `#E0489E` | Lisbonne, Le Cap, Rio de Janeiro |
| Orange | `#F97316` | Barcelone, Rome, Istanbul |
| Rubis | `#DC2626` | Berlin, Amsterdam, Séoul |
| Safran | `#F5C518` | Londres, Sydney, Los Angeles |
| Émeraude | `#16A34A` | Tokyo, New York, Singapour |
| Nuit | `#1D4ED8` | Dubaï, Monaco |

## Les 40 cases

| # | Case | Groupe | Couleur | Prix | Maison | Loyers : nu / 1 / 2 / 3 / 4 / hôtel |
|---|---|---|---|---|---|---|
| 0 | Départ | — | — | — | — | — |
| 1 | **Marrakech** · Maroc | Terre | `#8B5A3C` | 60 € | 50 € | 2 / 10 / 30 / 90 / 160 / 250 |
| 2 | Destin | — | — | — | — | — |
| 3 | **Le Caire** · Égypte | Terre | `#8B5A3C` | 60 € | 50 € | 4 / 20 / 60 / 180 / 320 / 450 |
| 4 | Impôt Mondial | — | — | −200 € | — | — |
| 5 | Hub Atlantique | — | — | 200 € | — | — |
| 6 | **Bangkok** · Thaïlande | Azur | `#38BDF8` | 100 € | 50 € | 6 / 30 / 90 / 270 / 400 / 550 |
| 7 | Marché | — | — | — | — | — |
| 8 | **Hanoï** · Viêt Nam | Azur | `#38BDF8` | 100 € | 50 € | 6 / 30 / 90 / 270 / 400 / 550 |
| 9 | **Bali** · Indonésie | Azur | `#38BDF8` | 120 € | 50 € | 8 / 40 / 100 / 300 / 450 / 600 |
| 10 | Prison | — | — | — | — | — |
| 11 | **Lisbonne** · Portugal | Fuchsia | `#E0489E` | 140 € | 100 € | 10 / 50 / 150 / 450 / 625 / 750 |
| 12 | Réseau Solaire | — | — | 150 € | — | — |
| 13 | **Le Cap** · Afrique du Sud | Fuchsia | `#E0489E` | 140 € | 100 € | 10 / 50 / 150 / 450 / 625 / 750 |
| 14 | **Rio de Janeiro** · Brésil | Fuchsia | `#E0489E` | 160 € | 100 € | 12 / 60 / 180 / 500 / 700 / 900 |
| 15 | Hub Pacifique | — | — | 200 € | — | — |
| 16 | **Barcelone** · Espagne | Orange | `#F97316` | 180 € | 100 € | 14 / 70 / 200 / 550 / 750 / 950 |
| 17 | Marché | — | — | — | — | — |
| 18 | **Rome** · Italie | Orange | `#F97316` | 180 € | 100 € | 14 / 70 / 200 / 550 / 750 / 950 |
| 19 | **Istanbul** · Turquie | Orange | `#F97316` | 200 € | 100 € | 16 / 80 / 220 / 600 / 800 / 1 000 |
| 20 | Parc Gratuit | — | — | — | — | — |
| 21 | **Berlin** · Allemagne | Rubis | `#DC2626` | 220 € | 150 € | 18 / 90 / 250 / 700 / 875 / 1 050 |
| 22 | Destin | — | — | — | — | — |
| 23 | **Amsterdam** · Pays-Bas | Rubis | `#DC2626` | 220 € | 150 € | 18 / 90 / 250 / 700 / 875 / 1 050 |
| 24 | **Séoul** · Corée du Sud | Rubis | `#DC2626` | 240 € | 150 € | 20 / 100 / 300 / 750 / 925 / 1 100 |
| 25 | Hub Méditerranée | — | — | 200 € | — | — |
| 26 | **Londres** · Royaume-Uni | Safran | `#F5C518` | 260 € | 150 € | 22 / 110 / 330 / 800 / 975 / 1 150 |
| 27 | **Sydney** · Australie | Safran | `#F5C518` | 260 € | 150 € | 22 / 110 / 330 / 800 / 975 / 1 150 |
| 28 | Réseau Orbital | — | — | 150 € | — | — |
| 29 | **Los Angeles** · États-Unis | Safran | `#F5C518` | 280 € | 150 € | 24 / 120 / 360 / 850 / 1 025 / 1 200 |
| 30 | Allez en Prison | — | — | — | — | — |
| 31 | **Tokyo** · Japon | Émeraude | `#16A34A` | 300 € | 200 € | 26 / 130 / 390 / 900 / 1 100 / 1 275 |
| 32 | **New York** · États-Unis | Émeraude | `#16A34A` | 300 € | 200 € | 26 / 130 / 390 / 900 / 1 100 / 1 275 |
| 33 | Marché | — | — | — | — | — |
| 34 | **Singapour** · Singapour | Émeraude | `#16A34A` | 320 € | 200 € | 28 / 150 / 450 / 1 000 / 1 200 / 1 400 |
| 35 | Hub Orient | — | — | 200 € | — | — |
| 36 | Destin | — | — | — | — | — |
| 37 | **Dubaï** · É.A.U. | Nuit | `#1D4ED8` | 350 € | 200 € | 35 / 175 / 500 / 1 100 / 1 300 / 1 500 |
| 38 | Taxe de Luxe | — | — | −100 € | — | — |
| 39 | **Monaco** · Monaco | Nuit | `#1D4ED8` | 400 € | 200 € | 50 / 200 / 600 / 1 400 / 1 700 / 2 000 |

## Mentions à imprimer sur les cases

- **Hubs** (4) : loyer 25 € / 50 € / 100 € / 200 € selon le nombre possédé
- **Réseaux** (2) : loyer de 4 × ou 10 × la somme des dés
- **Départ** : +200 € au passage, +400 € en arrivée exacte
- **Prison** : caution 50 €, ou un double, 3 tentatives
- **Parc Gratuit** : encaisse 100 % de la cagnotte
- **Hypothèque** : 50 % du prix, levée à 110 %

## Centre du plateau

Logo FORTUNE CITY au fond, planisphère gravé au centre, zone proche laissée
libre pour les dés. Carré de **18,45 unités**, soit 76 % de la largeur du plateau.

## Formats attendus

| Livrable | Taille | Contrainte |
|---|---|---|
| Plateau complet | 2048 × 2048 min, 4096 idéal | carré, **à plat vu du dessus**, bord à bord, sans ombre ni perspective |
| Centre seul | 2048 × 2048 | carré, à plat |

Aucune ombre portée, aucun reflet, aucun vignetage : la 3D les ajoute, sinon
ils se dédoublent.
