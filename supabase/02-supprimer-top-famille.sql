-- ============================================================================
-- SUPPRESSION — IRRÉVERSIBLE.
--
-- Ne lancez ce fichier qu'APRÈS avoir lu la sortie de `01-inspecter.sql`
-- et remplacé les noms ci-dessous par ceux réellement listés.
--
-- Les noms sont volontairement laissés en exemple : un script générique
-- (`drop schema public cascade`) emporterait aussi extensions, droits et
-- objets internes de Supabase. On supprime donc objet par objet.
-- ============================================================================

begin;

-- 1. Tables de l'ancien jeu — remplacez par la liste réelle.
-- drop table if exists public.<table_1> cascade;
-- drop table if exists public.<table_2> cascade;

-- 2. Vues éventuelles
-- drop view if exists public.<vue> cascade;

-- 3. Fonctions éventuelles
-- drop function if exists public.<fonction>() cascade;

-- Vérifiez le résultat AVANT de valider :
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- Si la liste est conforme :
commit;
-- Sinon :
-- rollback;
