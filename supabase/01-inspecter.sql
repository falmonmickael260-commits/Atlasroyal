-- ============================================================================
-- LECTURE SEULE — ne modifie rien.
-- À coller dans l'éditeur SQL Supabase pour voir ce que contient le projet
-- avant toute suppression.
-- ============================================================================

-- 1. Tables du schéma public, avec leur nombre de lignes estimé
select
  c.relname                       as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as taille,
  c.reltuples::bigint             as lignes_estimees
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;

-- 2. Vues
select table_name from information_schema.views where table_schema = 'public';

-- 3. Fonctions
select p.proname as fonction
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- 4. Politiques RLS
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename;

-- 5. Buckets de stockage
select id, name, public from storage.buckets;
