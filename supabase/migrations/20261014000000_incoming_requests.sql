-- Pedido recebido: quem recebe vê "X quer viajar com você", aceita (= pedir de volta,
-- o que já gera o aceite mútuo) ou recusa. Aceitar outra pessoa pode recusar antes a que
-- pediu (`declineIncoming`), sem corrida entre duas chamadas.
alter table public.requests drop constraint requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('pending', 'matched', 'cancelled', 'expired', 'unavailable', 'declined'));

create or replace function app_private.snapshot(uid uuid, msg text default null) returns jsonb
language plpgsql as $$
declare
  p public.profiles; i public.intents; us public.user_state; nid bigint; n public.negotiations;
  me public.negotiation_members; other_id uuid; oi public.intents;
  candidates jsonb := '[]'::jsonb; pending text; matched text; proposal jsonb; msgs jsonb := '[]'::jsonb;
  post jsonb; ended timestamptz; notice text; incoming text; fi public.intents;
begin
  perform app_private.advance(uid);
  select * into p from public.profiles where user_id = uid;
  i := app_private.live_intent(uid);
  select * into us from public.user_state where user_id = uid;
  nid := app_private.active_negotiation(uid);

  if nid is not null then
    select * into n from public.negotiations where id = nid;
    select * into me from public.negotiation_members where negotiation_id = nid and user_id = uid;
    select m.user_id into other_id from public.negotiation_members m
      where m.negotiation_id = nid and m.user_id <> uid;
    select i2.* into oi from public.negotiation_members m join public.intents i2 on i2.id = m.intent_id
      where m.negotiation_id = nid and m.user_id <> uid;
    matched := other_id::text;
    candidates := jsonb_build_array(app_private.candidate_json(i, oi));
    proposal := app_private.proposal_json(n, uid);
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id,
        'sender', case when x.sender = uid then 'mine' else 'theirs' end,
        'text', x.body, 'at', app_private.iso(x.created_at)) order by x.id), '[]'::jsonb)
      into msgs from public.messages x where x.negotiation_id = nid;
    ended := app_private.trip_end(n.departure);
    if app_private.agreed(n) and now() >= ended then
      post := jsonb_build_object(
        'negotiation', nid, 'companion', other_id, 'endedAt', app_private.iso(ended),
        'happened', me.outcome, 'reason', me.outcome_reason,
        'mine', app_private.review_json(nid, uid, false),
        'theirs', app_private.review_json(nid, other_id,
          not exists (select 1 from public.reviews where negotiation_id = nid and reviewer = uid)));
    end if;
  else
    candidates := app_private.discover(uid);
    select q.to_user::text into pending from public.requests q where q.from_user = uid and q.status = 'pending';
    if pending is not null and not exists (select 1 from jsonb_array_elements(candidates) c where c ->> 'id' = pending) then
      -- o alvo continua válido, mas deixou de aparecer (ex.: já não cabe): mantém a projeção
      select candidates || jsonb_build_array(app_private.candidate_json(i, o)) into candidates
        from public.requests q join public.intents o on o.id = q.to_intent
        where q.from_user = uid and q.status = 'pending';
    end if;
    -- Pedido recebido: a pessoa pediu a mim e ainda cabe (a mais antiga primeiro).
    if i.id is not null and i.status = 'active' then
      select f.* into fi from public.requests q
        join public.intents f on f.id = q.from_intent
        where q.to_user = uid and q.status = 'pending' and q.to_intent = i.id
          and f.status = 'active' and now() < least(f.departure, i.departure)
          and exists (select 1 from public.profiles pr where pr.user_id = q.from_user)
          and not app_private.blocked_between(uid, q.from_user)
          and (select ok from app_private.pair(i, f, now()))
        order by q.id limit 1;
      if fi.id is not null then
        incoming := fi.user_id::text;
        if not exists (select 1 from jsonb_array_elements(candidates) c where c ->> 'id' = incoming) then
          candidates := candidates || jsonb_build_array(app_private.candidate_json(i, fi));
        end if;
      end if;
    end if;
  end if;

  notice := coalesce(msg, nullif(us.notice, ''), '');
  if msg is null and us.notice <> '' then
    update public.user_state set notice = '' where user_id = uid;
  end if;

  return jsonb_build_object(
    'profile', case when p.user_id is null then null else jsonb_build_object(
      'email', p.email, 'name', p.name, 'phone', p.phone,
      'birth', to_char(p.birth, 'YYYY-MM-DD'), 'photo', p.photo) end,
    'intent', case when i.id is null then null else jsonb_strip_nulls(jsonb_build_object(
      'departure', app_private.iso(i.departure), 'timeZone', i.time_zone, 'fixed', i.fixed,
      'passengers', i.passengers, 'walkingLimit', i.walking_limit,
      'origin', i.origin, 'destination', i.destination,
      'points', case when i.origin_lat is null then null else jsonb_build_object(
        'origin', jsonb_build_object('latitude', i.origin_lat, 'longitude', i.origin_lon),
        'destination', jsonb_build_object('latitude', i.dest_lat, 'longitude', i.dest_lon)) end)) end,
    'candidates', candidates,
    'pending', pending,
    'incoming', incoming,
    'matched', matched,
    'revision', coalesce(us.revision, 0),
    'proposal', proposal,
    'messages', msgs,
    'postTrip', post,
    'history', app_private.history_json(uid),
    'blocked', coalesce((select jsonb_agg(b.blocked order by b.created_at) from public.blocks b where b.blocker = uid), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('companion', r.reported, 'reason', r.reason,
        'details', r.details, 'at', app_private.iso(r.created_at)) order by r.id)
        from public.reports r where r.reporter = uid), '[]'::jsonb),
    'message', notice);
end $$;

create or replace function public.app_request_send(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'request_send'; res jsonb;
  target uuid; expected bigint; mine public.intents; theirs public.intents;
  cur public.user_state; old public.requests; incoming public.requests; nid bigint;
  ok boolean; dep timestamptz; stale constant text :=
    'Algo mudou. A solicitação anterior foi preservada se ainda válida. Reveja as sugestões.';
begin
  body := app_private.j_body(body);
  begin
    target := app_private.j_text(body, 'candidateId', 100)::uuid;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  expected := app_private.j_int(body, 'expectedRevision');
  if target = uid then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
  if not exists (select 1 from public.profiles where user_id = target) then
    perform app_private.fail('PT409', stale);
  end if;
  perform app_private.lock_users(uid, target);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  perform app_private.advance(uid);
  select * into cur from public.user_state where user_id = uid;
  if cur.revision <> expected then perform app_private.fail('PT409', stale); end if;
  mine := app_private.live_intent(uid);
  theirs := app_private.live_intent(target);
  if mine.id is null or mine.status <> 'active' or theirs.id is null or theirs.status <> 'active'
     or app_private.active_negotiation(uid) is not null
     or app_private.blocked_between(uid, target)
     or not exists (select 1 from public.profiles where user_id = uid)
     or not exists (select 1 from public.profiles where user_id = target) then
    perform app_private.fail('PT409', stale);
  end if;
  select p.ok into ok from app_private.pair(mine, theirs, now()) p;
  if not ok then perform app_private.fail('PT409', stale); end if;

  -- Aceitar outra pessoa recusando antes quem pediu a mim (confirmado no app).
  if body ? 'declineIncoming' and app_private.j_bool(body, 'declineIncoming') then
    update public.requests set status = 'declined', resolved_at = now()
      where to_user = uid and status = 'pending' and from_user <> target;
  end if;

  select * into old from public.requests where from_user = uid and status = 'pending';
  if old.id is not null and old.to_user = target then
    return app_private.remember(uid, op, body, app_private.snapshot(uid)); -- já pedido
  end if;

  -- Interesse do outro lado já existe? Então é aceite mútuo.
  select * into incoming from public.requests
    where from_user = target and to_user = uid and status = 'pending'
      and from_intent = theirs.id and to_intent = mine.id;
  if old.id is not null then
    update public.requests set status = 'cancelled', resolved_at = now() where id = old.id;
  end if;
  if incoming.id is null then
    insert into public.requests (from_user, to_user, from_intent, to_intent)
    values (uid, target, mine.id, theirs.id);
    perform app_private.bump(uid, 'Aguardando a companhia. A viagem não está confirmada.');
    perform app_private.notify(target, 'company_requested', '{}');
    return app_private.remember(uid, op, body, app_private.snapshot(uid));
  end if;

  update public.requests set status = 'matched', resolved_at = now() where id = incoming.id;
  update public.requests set status = 'cancelled', resolved_at = now()
    where from_user in (uid, target) and status = 'pending';
  -- pedidos de terceiros a estas duas pessoas viram "indisponível" em advance()
  dep := app_private.shared_departure(mine, theirs);
  insert into public.negotiations (departure) values (dep) returning id into nid;
  insert into public.negotiation_members (negotiation_id, user_id, intent_id)
  values (nid, uid, mine.id), (nid, target, theirs.id);
  update public.intents set status = 'matched' where id in (mine.id, theirs.id);
  perform app_private.bump(uid, 'Aceite mútuo. A viagem ainda não está combinada.');
  perform app_private.bump(target, 'Aceite mútuo. A viagem ainda não está combinada.');
  perform app_private.notify(target, 'matched', jsonb_build_object('negotiation', nid));
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_request_decline(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb; uid uuid := app_private.me(); op text := 'request_decline'; res jsonb; target uuid;
begin
  body := app_private.j_body($1);
  begin
    target := app_private.j_text(body, 'candidateId', 100)::uuid;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  if target = uid then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
  perform app_private.lock_users(uid, target);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  perform app_private.advance(uid);
  update public.requests set status = 'declined', resolved_at = now()
    where from_user = target and to_user = uid and status = 'pending';
  if found then
    perform app_private.bump(uid);
    perform app_private.bump(target, 'A pessoa recusou sua solicitação. Continue vendo sugestões.');
    perform app_private.notify(target, 'request_declined', '{}');
  end if;
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

revoke all on function public.app_request_decline(jsonb) from public, anon;
grant execute on function public.app_request_decline(jsonb) to authenticated;
