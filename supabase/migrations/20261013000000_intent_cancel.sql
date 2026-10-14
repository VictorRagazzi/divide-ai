-- Cancelar a busca ativa (antes só existia "buscar de novo", que substitui a anterior).
-- Fecha a busca e cancela o pedido pendente. Negociação em andamento é exclusiva:
-- nesse caso a busca não é mexida (a pessoa cancela a participação na negociação).
create function public.app_intent_cancel(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := coalesce($1, '{}'::jsonb); uid uuid := app_private.me();
  op text := 'intent_cancel'; res jsonb;
begin
  perform app_private.lock_users(uid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  perform app_private.advance(uid);
  if app_private.active_negotiation(uid) is not null then
    return app_private.snapshot(uid, 'Você tem uma viagem em andamento. Cancele a participação nela primeiro.');
  end if;
  update public.requests set status = 'cancelled', resolved_at = now()
    where from_user = uid and status = 'pending';
  update public.intents set status = 'closed' where user_id = uid and status = 'active';
  perform app_private.bump(uid);
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

revoke all on function public.app_intent_cancel(jsonb) from public, anon;
grant execute on function public.app_intent_cancel(jsonb) to authenticated;
