![Aperçu du plateau Godot](preview.jpg)

# ATLAS ROYAL — Le Grand Tour

Prototype visuel original sous **Godot 4.6**. Plateau 3D autonome avec les 40 cases du jeu Atlasroyal, 22 monuments stylisés, matériaux ivoire/laiton/vert profond, rose des vents, cartes et quatre pions.

## Ouvrir

1. Télécharger cette branche GitHub (Code → Download ZIP) et décompresser.
2. Dans Godot 4.6, importer `godot/project.godot`.
3. Appuyer sur **F6** depuis `main.tscn`, ou **F5** pour le projet.

Le décor est créé par `main.gd` à l'exécution : lancez la scène pour le voir. Aucun plugin, serveur ou téléchargement d'assets nécessaire.

## Commandes

- Bouton droit + glisser : tourner la caméra.
- Molette : zoomer.
- Clic gauche sur une case : nom, pays et prix.
- Espace / Lancer les dés : lancer animé et déplacement du pion doré.
- Vue cinéma : activer ou arrêter l'orbite automatique.
- Vue du dessus : observer le plateau en plan.
- R : rétablir la caméra initiale.

## Périmètre

Il s'agit du premier prototype de plateau demandé : aucun salon, backend, bot, achat ou règle économique n'est connecté. Les trois autres pions sont décoratifs. Les dés utilisent des valeurs aléatoires et des orientations correspondant à leurs faces ; l'animation est chorégraphiée, sans simulation physique.

Les monuments sont des miniatures procédurales stylisées inspirées des types du plateau, et non des reproductions architecturales exactes. Les cases sont importées de `src/engine/board.ts` ; `assets/board.json` constitue l'instantané utilisé par ce prototype.

## Structure

- `main.gd` : géométrie, matériaux, interface et interactions.
- `main.tscn` : scène principale.
- `assets/board.json` : 40 cases et données des villes.
- `smoke.gd` : vérifie la création du plateau et un déplacement complet.

Vérification sans interface : `godot --headless --path godot --script res://smoke.gd`.
