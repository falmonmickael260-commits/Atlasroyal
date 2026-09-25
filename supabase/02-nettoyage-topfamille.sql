begin;

-- Tables du jeu Top Famille (toutes préfixées tf_).
drop table if exists
  public.tf_answers,
  public.tf_events,
  public.tf_finale_answers,
  public.tf_games,
  public.tf_players,
  public.tf_questions,
  public.tf_reveals
cascade;

-- Fonctions associées (tf_* et _tf_*), supprimées par signature.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'tf\_%' or p.proname like '\_tf\_%')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

commit;
