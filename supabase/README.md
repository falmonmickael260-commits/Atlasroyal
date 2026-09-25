# Supabase

## ATLAS ROYALE n'a besoin d'aucune table

Le multijoueur passe uniquement par **Realtime broadcast** : un canal par
salon, deux évènements (`to_host`, `to_all`). Rien n'est persisté côté base.
Il suffit donc de renseigner les deux variables d'environnement :

```
VITE_SUPABASE_URL=https://wfguhfovryflzwtgpjdb.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon publique>
```

La clé `anon` est **publique par conception** (elle part dans le bundle du
navigateur). Ne jamais mettre la clé `service_role` dans une variable `VITE_*`.

## Nettoyer l'ancien projet

1. Lancez `01-inspecter.sql` dans l'éditeur SQL Supabase — **lecture seule**.
2. Vérifiez la liste : c'est irréversible ensuite.
3. Le script de suppression sera écrit à partir de cette liste, table par
   table, plutôt qu'un `drop schema public cascade` qui emporterait aussi
   les extensions et les droits.

3. Adaptez `02-supprimer-top-famille.sql` avec les noms réellement trouvés,
   puis lancez-le. Il est encadré par `begin` / `commit` avec une
   vérification intermédiaire : vous pouvez faire `rollback` si la liste
   ne correspond pas.

> Faites une sauvegarde avant (Dashboard → Database → Backups) si le moindre
> doute subsiste sur ce que contient le projet.

## Brancher le multijoueur entre appareils

Une fois la clé `anon` récupérée (Dashboard → Project Settings → API) :

```bash
cd ~/Desktop/atlas-royale
vercel env add VITE_SUPABASE_URL production      # https://wfguhfovryflzwtgpjdb.supabase.co
vercel env add VITE_SUPABASE_ANON_KEY production # la clé anon
vercel --prod                                    # redéploie avec les variables
```

L'option « Serveur temps réel » apparaît alors sur l'écran d'accueil.
