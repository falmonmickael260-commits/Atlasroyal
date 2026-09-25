# Supabase

Projet utilisé : **`wfguhfovryflzwtgpjdb`** (région `eu-west-1`).

## ATLAS ROYALE n'a besoin d'aucune table

Le multijoueur passe uniquement par **Realtime broadcast** : un canal par
salon, deux évènements (`to_host`, `to_all`). Rien n'est persisté en base.
Seules deux variables d'environnement sont nécessaires :

```
VITE_SUPABASE_URL=https://wfguhfovryflzwtgpjdb.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon>
```

Elles sont déjà configurées sur Vercel (`production`, `preview`,
`development`). En local : `cp .env.example .env.local` puis renseignez-les.

La clé `anon` est **publique par conception** — elle part dans le bundle du
navigateur. Ne jamais mettre la clé `service_role` dans une variable `VITE_*`.

## Nettoyage de l'ancien jeu — fait

Le projet hébergeait auparavant « Top Famille ». Inventaire relevé avant
suppression :

| Élément | Quantité |
|---|---|
| Tables (`tf_answers`, `tf_events`, `tf_finale_answers`, `tf_games`, `tf_players`, `tf_questions`, `tf_reveals`) | 7 — 1 709 lignes |
| Fonctions (`tf_*`, `_tf_*`) | 43 |
| Contraintes | 31 |
| Politiques RLS | 3 |
| Vues, types énumérés, buckets de stockage | 0 |

`02-nettoyage-topfamille.sql` est le script réellement exécuté. Le schéma
`public` est désormais vide.

**Non touché : les 71 comptes dans `auth.users`.** Ils ne faisaient pas
partie de la demande. Pour les supprimer aussi, c'est une opération distincte
et tout aussi irréversible — à décider explicitement.

Une sauvegarde JSON complète (données + définitions) a été déposée dans
`~/Desktop/sauvegarde-topfamille/` avant l'opération. Elle ne fait pas partie
du dépôt : ce sont des données de production.

## Inspecter le projet

`01-inspecter.sql` liste tables, vues, fonctions, politiques et buckets.
Il est en **lecture seule**.

```bash
supabase db query --linked --project-ref wfguhfovryflzwtgpjdb -f supabase/01-inspecter.sql
```
