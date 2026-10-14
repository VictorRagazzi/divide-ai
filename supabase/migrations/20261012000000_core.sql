-- Divide aí — núcleo do backend (dupla de contas, fluxo completo até a avaliação).
--
-- Todo acesso do app passa por funções `public.app_*` (RPC do PostgREST), que
-- implementam o contrato de documentos/Integracao_backend.md. As tabelas ficam
-- fechadas (RLS ligada, sem política, sem permissão para anon/authenticated): o
-- app nunca lê nem escreve tabela diretamente, então campos privados (endereço,
-- coordenadas, e-mail, telefone) só saem pelas projeções montadas aqui.
--
-- Decisões de produto ainda pendentes NÃO viraram regra: ver o comentário
-- "PENDENTE" nos pontos afetados e a lista em documentos/Integracao_backend.md.

create schema if not exists app_private;
revoke all on schema app_private from public;

-- ------------------------------------------------------------------ tabelas

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null check (char_length(name) between 2 and 60),
  phone text not null default '' check (phone ~ '^([1-9][0-9]{9,10})?$'),
  birth date not null,
  photo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contador por pessoa: `revision` é devolvido ao app e confere pedidos velhos;
-- `notice` é um aviso de uma vez só (ex.: "A solicitação venceu").
create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision integer not null default 0,
  notice text not null default ''
);

create table public.intents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  departure timestamptz not null,
  time_zone text not null,
  fixed boolean not null,
  passengers smallint not null check (passengers between 1 and 2),
  walking_limit integer not null check (walking_limit between 0 and 5000),
  origin text not null check (char_length(origin) between 1 and 200),
  destination text not null check (char_length(destination) between 1 and 200),
  origin_lat double precision,
  origin_lon double precision,
  dest_lat double precision,
  dest_lon double precision,
  status text not null default 'active' check (status in ('active', 'matched', 'closed')),
  created_at timestamptz not null default now(),
  check ((origin_lat is null) = (origin_lon is null)),
  check ((dest_lat is null) = (dest_lon is null)),
  check ((origin_lat is null) = (dest_lat is null)),
  check (origin_lat is null or origin_lat between -90 and 90),
  check (dest_lat is null or dest_lat between -90 and 90),
  check (origin_lon is null or origin_lon between -180 and 180),
  check (dest_lon is null or dest_lon between -180 and 180)
);
-- Uma intenção viva por pessoa.
create unique index intents_one_live on public.intents (user_id) where status in ('active', 'matched');
create index intents_discovery on public.intents (departure) where status = 'active';

create table public.requests (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  from_intent bigint not null references public.intents (id),
  to_intent bigint not null references public.intents (id),
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'cancelled', 'expired', 'unavailable')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_user <> to_user)
);
-- No máximo uma solicitação de saída pendente por pessoa.
create unique index requests_one_pending on public.requests (from_user) where status = 'pending';
create index requests_incoming on public.requests (to_user) where status = 'pending';

create table public.negotiations (
  id bigint generated always as identity primary key,
  departure timestamptz not null, -- instante comum, dentro da interseção das janelas
  version integer not null default 1,
  status text not null default 'negotiating' check (status in ('negotiating', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- `pick` é absoluto (para as duas pessoas significa a mesma coisa): 'suggestion'
-- ou o id de quem tem o ponto escolhido. O app recebe a forma relativa a ele.
create table public.negotiation_members (
  negotiation_id bigint not null references public.negotiations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  intent_id bigint not null references public.intents (id),
  pick text,
  active boolean not null default true,
  outcome boolean, -- a viagem aconteceu? (nulo = ainda não respondeu)
  outcome_reason text check (outcome_reason in ('no-show', 'could-not-go', 'agreed-cancel', 'no-car', 'other')),
  closed_at timestamptz,
  primary key (negotiation_id, user_id),
  check (outcome is distinct from true or outcome_reason is null)
);
-- Participação exclusiva: ninguém está em duas negociações ao mesmo tempo.
create unique index members_one_active on public.negotiation_members (user_id) where active;

create table public.messages (
  id bigint generated always as identity primary key,
  negotiation_id bigint not null references public.negotiations (id) on delete cascade,
  sender uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_by_negotiation on public.messages (negotiation_id, id);

create table public.reviews (
  negotiation_id bigint not null references public.negotiations (id) on delete cascade,
  reviewer uuid not null references auth.users (id) on delete cascade,
  reviewee uuid not null references auth.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  primary key (negotiation_id, reviewer),
  check (reviewer <> reviewee),
  check (stars >= 3 or char_length(btrim(comment)) > 0)
);

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('behavior', 'unsafe', 'fake', 'payment', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (reporter <> reported),
  check (reason <> 'other' or char_length(btrim(details)) > 0)
);

-- Repetição segura: a mesma Idempotency-Key da mesma pessoa devolve o mesmo
-- resultado sem repetir o efeito.
create table public.operation_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  operation text not null,
  payload_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Eventos para entregar (push/e-mail) DEPOIS do commit; ainda sem consumidor.
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index outbox_pending on public.notification_outbox (id) where delivered_at is null;

-- Rotas a pé (percurso real, não linha reta). O SQL não chama provedores: um
-- worker no servidor (supabase/worker) lê a fila, consulta o provedor de rotas e
-- grava aqui. Sem rota calculada, o par não é elegível (Contratos_tecnicos:
-- "ausência de rota retorna indisponibilidade"). Coordenadas arredondadas a 5
-- casas (~1 m) e em ordem canônica, porque a rota a pé A->B vale para B->A.
create table public.walk_routes (
  a_lat numeric(8,5) not null, a_lon numeric(8,5) not null,
  b_lat numeric(8,5) not null, b_lon numeric(8,5) not null,
  meters integer not null check (meters >= 0),
  mid_lat numeric(8,5) not null, mid_lon numeric(8,5) not null, -- ponto do percurso na metade da distância
  provider text not null,
  fetched_at timestamptz not null default now(),
  primary key (a_lat, a_lon, b_lat, b_lon)
);

create table public.route_queue (
  a_lat numeric(8,5) not null, a_lon numeric(8,5) not null,
  b_lat numeric(8,5) not null, b_lon numeric(8,5) not null,
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  primary key (a_lat, a_lon, b_lat, b_lon)
);

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
      and tablename in ('profiles', 'user_state', 'intents', 'requests', 'negotiations',
        'negotiation_members', 'messages', 'reviews', 'blocks', 'reports',
        'operation_receipts', 'notification_outbox', 'walk_routes', 'route_queue')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public', t);
  end loop;
end $$;

-- O Supabase concede por padrão ALL em tabelas/sequências/funções novas de public
-- a anon e authenticated. Aqui só as funções app_* ficam abertas (ao final).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- ------------------------------------------------------------------ utilidades

create function app_private.fail(code text, message text) returns void
language plpgsql as $$
begin
  -- PTnnn vira o status HTTP nnn no PostgREST.
  raise exception '%', message using errcode = code;
end $$;

create function app_private.me() returns uuid
language plpgsql stable as $$
declare uid uuid := auth.uid();
begin
  if uid is null then perform app_private.fail('PT401', 'Entre para continuar.'); end if;
  return uid;
end $$;

create function app_private.iso(ts timestamptz) returns text
language sql immutable as $$
  select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;

-- "Rua X · bairro" -> "Rua X"
create function app_private.lead(label text) returns text
language sql immutable as $$ select btrim(split_part(label, ' · ', 1)) $$;

-- Distância em linha reta (haversine), em metros.
-- PENDENTE: serve só como filtro/estimativa. Caminhada real exige rota a pé de
-- um fornecedor (etapa 6); nunca apresentar isto como distância percorrida.
create function app_private.meters(lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision) returns double precision
language sql immutable as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))))
$$;

-- Trava as linhas de estado em ordem estável (evita impasse entre duas pessoas).
create function app_private.lock_users(a uuid, b uuid default null) returns void
language plpgsql as $$
begin
  insert into public.user_state (user_id) select u from unnest(array[a, b]) u where u is not null order by u
    on conflict do nothing;
  perform 1 from public.user_state where user_id in (a, coalesce(b, a)) order by user_id for update;
end $$;

create function app_private.bump(uid uuid, p_notice text default null) returns void
language sql as $$
  insert into public.user_state (user_id, revision, notice) values ($1, 1, coalesce($2, ''))
  on conflict (user_id) do update
    set revision = public.user_state.revision + 1,
        notice = case when $2 is null then public.user_state.notice else $2 end
$$;

create function app_private.notify(uid uuid, kind text, payload jsonb default '{}') returns void
language sql as $$
  insert into public.notification_outbox (user_id, kind, payload) values (uid, kind, payload)
$$;

-- Corpo do pedido -> campos tipados; erro de formato vira 422.
create function app_private.j_text(body jsonb, key text, max_len int default 200, required boolean default true)
returns text language plpgsql immutable as $$
declare v jsonb := body -> key;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > max_len then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  return v #>> '{}';
end $$;

create function app_private.j_int(body jsonb, key text, required boolean default true)
returns bigint language plpgsql immutable as $$
declare v jsonb := body -> key;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^-?[0-9]{1,15}$' then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  return (v #>> '{}')::bigint;
end $$;

create function app_private.j_bool(body jsonb, key text) returns boolean
language plpgsql immutable as $$
declare v jsonb := body -> key;
begin
  if v is null or jsonb_typeof(v) <> 'boolean' then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  return (v #>> '{}')::boolean;
end $$;

create function app_private.j_body(body jsonb) returns jsonb
language plpgsql immutable as $$
begin
  if body is null or jsonb_typeof(body) <> 'object' then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  return body;
end $$;

-- Idempotência -----------------------------------------------------------------

create function app_private.idem_key() returns text
language plpgsql stable as $$
declare headers jsonb;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  return case when char_length(headers ->> 'idempotency-key') > 100 then null else nullif(headers ->> 'idempotency-key', '') end;
exception when others then
  return null;
end $$;

-- Devolve o resultado guardado, se a chave já foi usada por esta pessoa.
create function app_private.replay(uid uuid, op text, payload jsonb) returns jsonb
language plpgsql as $$
declare k text := app_private.idem_key(); r public.operation_receipts;
begin
  if k is null then return null; end if;
  select * into r from public.operation_receipts where user_id = uid and key = k;
  if not found then return null; end if;
  if r.operation <> op or r.payload_hash <> md5(payload::text) then
    perform app_private.fail('PT422', 'Esta chave de repetição já foi usada em outro pedido.');
  end if;
  return r.response;
end $$;

create function app_private.remember(uid uuid, op text, payload jsonb, response jsonb) returns jsonb
language plpgsql as $$
declare k text := app_private.idem_key();
begin
  if k is not null then
    insert into public.operation_receipts (user_id, key, operation, payload_hash, response)
    values (uid, k, op, md5(payload::text), response)
    on conflict do nothing;
  end if;
  return response;
end $$;

-- ------------------------------------------------------------------ domínio

create function app_private.live_intent(uid uuid) returns public.intents
language sql stable as $$
  select * from public.intents where user_id = uid and status in ('active', 'matched')
$$;

-- Negociação em andamento da pessoa (a que a mantém exclusiva), ou nulo.
create function app_private.active_negotiation(uid uuid) returns bigint
language sql stable as $$
  select negotiation_id from public.negotiation_members where user_id = uid and active
$$;

-- Janela de horários aceitos: ±15 min se flexível, o instante exato se fixo.
create function app_private.window_start(departure timestamptz, fixed boolean) returns timestamptz
language sql immutable as $$ select departure - case when fixed then interval '0' else interval '15 minutes' end $$;
create function app_private.window_end(departure timestamptz, fixed boolean) returns timestamptz
language sql immutable as $$ select departure + case when fixed then interval '0' else interval '15 minutes' end $$;

-- Rota a pé em cache entre dois pontos (metros), ou nulo se ainda não existe.
create function app_private.route_meters(lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision) returns integer
language plpgsql stable as $$
declare a1 numeric(8,5) := round(lat1::numeric, 5); o1 numeric(8,5) := round(lon1::numeric, 5);
  a2 numeric(8,5) := round(lat2::numeric, 5); o2 numeric(8,5) := round(lon2::numeric, 5);
  t1 numeric(8,5); t2 numeric(8,5); m integer;
begin
  if a1 = a2 and o1 = o2 then return 0; end if;
  if (a1, o1) > (a2, o2) then
    t1 := a1; t2 := o1; a1 := a2; o1 := o2; a2 := t1; o2 := t2;
  end if;
  select meters into m from public.walk_routes
    where a_lat = a1 and a_lon = o1 and b_lat = a2 and b_lon = o2;
  return m;
end $$;

-- Coloca um par de pontos na fila do worker de rotas (se ainda não há rota).
create function app_private.queue_route(lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision) returns void
language plpgsql as $$
declare a1 numeric(8,5) := round(lat1::numeric, 5); o1 numeric(8,5) := round(lon1::numeric, 5);
  a2 numeric(8,5) := round(lat2::numeric, 5); o2 numeric(8,5) := round(lon2::numeric, 5);
  t1 numeric(8,5); t2 numeric(8,5);
begin
  if app_private.route_meters(lat1, lon1, lat2, lon2) is not null then return; end if;
  if (a1, o1) > (a2, o2) then
    t1 := a1; t2 := o1; a1 := a2; o1 := o2; a2 := t1; o2 := t2;
  end if;
  insert into public.route_queue (a_lat, a_lon, b_lat, b_lon) values (a1, o1, a2, o2)
  on conflict do nothing;
end $$;

-- Pede as rotas dos pares plausíveis de uma intenção nova. A linha reta é só o
-- filtro (a rota a pé nunca é mais curta que ela): se a linha reta já passa da
-- soma dos limites, a rota também passaria.
create function app_private.enqueue_routes(i public.intents) returns void
language plpgsql as $$
declare o public.intents;
begin
  if i.origin_lat is null then return; end if;
  for o in
    select * from public.intents x
    where x.status = 'active' and x.user_id <> i.user_id and x.origin_lat is not null
      and x.departure > now()
      and app_private.meters(i.origin_lat, i.origin_lon, x.origin_lat, x.origin_lon) <= i.walking_limit + x.walking_limit
      and app_private.meters(i.dest_lat, i.dest_lon, x.dest_lat, x.dest_lon) <= i.walking_limit + x.walking_limit
    order by x.departure limit 30
  loop
    perform app_private.queue_route(i.origin_lat, i.origin_lon, o.origin_lat, o.origin_lon);
    perform app_private.queue_route(i.dest_lat, i.dest_lon, o.dest_lat, o.dest_lon);
  end loop;
end $$;

-- Compatibilidade entre duas intenções no instante `moment` (mesma regra do app).
-- Devolve o percurso a pé entre as origens e entre os destinos (nulo = rota ainda
-- não calculada, e então o par não é elegível).
create function app_private.pair(a public.intents, b public.intents, moment timestamptz,
  out ok boolean, out d_origin integer, out d_dest integer)
language plpgsql stable as $$
begin
  d_origin := null; d_dest := null; ok := false;
  if a.origin_lat is null or b.origin_lat is null then return; end if; -- sem pontos, sem descoberta
  d_origin := app_private.route_meters(a.origin_lat, a.origin_lon, b.origin_lat, b.origin_lon);
  d_dest := app_private.route_meters(a.dest_lat, a.dest_lon, b.dest_lat, b.dest_lon);
  if d_origin is null or d_dest is null then return; end if;
  ok := moment < least(a.departure, b.departure)
    and a.passengers + b.passengers <= 3
    and greatest(app_private.window_start(a.departure, a.fixed), app_private.window_start(b.departure, b.fixed))
      <= least(app_private.window_end(a.departure, a.fixed), app_private.window_end(b.departure, b.fixed))
    -- sugestão = ponto no meio do percurso: cada um caminha metade
    and (d_origin + 1) / 2 <= least(a.walking_limit, b.walking_limit)
    and (d_dest + 1) / 2 <= least(a.walking_limit, b.walking_limit);
end $$;

-- Horário comum escolhido na interseção, igual para as duas pessoas.
create function app_private.shared_departure(a public.intents, b public.intents) returns timestamptz
language sql immutable as $$
  select greatest(
    greatest(app_private.window_start(a.departure, a.fixed), app_private.window_start(b.departure, b.fixed)),
    least(a.departure, least(app_private.window_end(a.departure, a.fixed), app_private.window_end(b.departure, b.fixed))))
$$;

create function app_private.blocked_between(a uuid, b uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

-- Nota pública: média das avaliações que a pessoa recebeu.
create function app_private.rating_of(uid uuid, out average numeric, out total integer, out trips integer)
language sql stable as $$
  -- Toda avaliação recebida conta na nota, mesmo de quem nunca avaliou; o que
  -- fica oculto até a pessoa avaliar é o CONTEÚDO (review_json), não a nota.
  select (select round(avg(r.stars), 1) from public.reviews r where r.reviewee = uid),
         (select count(*)::int from public.reviews r where r.reviewee = uid),
         (select count(*)::int from public.negotiation_members m
            where m.user_id = uid and m.outcome is true)
$$;

create function app_private.band(meters int) returns int
language sql immutable as $$ select ((meters + 99) / 100) * 100 $$;

-- Projeção de descoberta: sem endereço, coordenadas, foto ou e-mail.
create function app_private.candidate_json(mine public.intents, other public.intents) returns jsonb
language plpgsql stable as $$
declare p public.profiles; q record; m record;
begin
  select * into p from public.profiles where user_id = other.user_id;
  select * into q from app_private.rating_of(other.user_id);
  select * into m from app_private.pair(mine, other, '-infinity'); -- só as distâncias
  return jsonb_build_object(
    'id', other.user_id,
    'name', coalesce(p.name, 'Companhia'),
    'departure', app_private.iso(other.departure),
    'fixed', other.fixed,
    'passengers', other.passengers,
    'walkingLimit', other.walking_limit,
    -- Faixas de 100 m (para cima): a distância exata, repetida com várias posições
    -- de teste, permitiria descobrir onde a pessoa está (trilateração).
    'pickup', app_private.band((coalesce(m.d_origin, 0) + 1) / 2),
    'dropoff', app_private.band((coalesce(m.d_dest, 0) + 1) / 2),
    'companionPickup', app_private.band((coalesce(m.d_origin, 0) + 1) / 2),
    'companionDropoff', app_private.band((coalesce(m.d_dest, 0) + 1) / 2),
    'rating', coalesce(replace(q.average::text, '.', ','), 'Novo'),
    'trips', coalesce(q.trips, 0));
end $$;

create function app_private.discover(uid uuid) returns jsonb
language plpgsql stable as $$
declare mine public.intents := app_private.live_intent(uid); o public.intents; result jsonb := '[]'::jsonb;
begin
  if mine.id is null or mine.status <> 'active' then return result; end if;
  for o in
    select * from public.intents x
    where x.status = 'active' and x.user_id <> uid
      and exists (select 1 from public.profiles p where p.user_id = x.user_id)
      and not app_private.blocked_between(uid, x.user_id)
      and (select ok from app_private.pair(mine, x, now()))
    order by x.departure, x.id limit 20
  loop
    result := result || jsonb_build_array(app_private.candidate_json(mine, o));
  end loop;
  return result;
end $$;

-- Fim da viagem: horário combinado + atraso (PENDENTE: duração/lembrete reais).
create function app_private.trip_end(departure timestamptz) returns timestamptz
language sql immutable as $$ select departure + interval '1 hour' $$;

-- Escolha absoluta -> relativa a quem olha.
create function app_private.pick_to_wire(pick text, viewer uuid) returns jsonb
language sql immutable as $$
  select case
    when pick is null then null
    when pick = 'suggestion' then jsonb_build_object('choice', 'suggestion')
    when pick = viewer::text then jsonb_build_object('choice', 'mine')
    else jsonb_build_object('choice', 'theirs') end
$$;

-- Conteúdo de uma escolha, do ponto de vista de `viewer`.
create function app_private.proposal_json(n public.negotiations, viewer uuid) returns jsonb
language plpgsql stable as $$
declare
  me public.negotiation_members; ot public.negotiation_members;
  im public.intents; io public.intents; d record;
  choice text; walks int[]; pickup text; dropoff text;
begin
  select * into me from public.negotiation_members where negotiation_id = n.id and user_id = viewer;
  select * into ot from public.negotiation_members where negotiation_id = n.id and user_id <> viewer;
  select * into im from public.intents where id = me.intent_id;
  select * into io from public.intents where id = ot.intent_id;
  select * into d from app_private.pair(im, io, '-infinity');
  choice := case when me.pick is null or me.pick = 'suggestion' then 'suggestion'
                 when me.pick = viewer::text then 'mine' else 'theirs' end;
  walks := case choice
    when 'mine' then array[0, 0, d.d_origin, d.d_dest]
    when 'theirs' then array[d.d_origin, d.d_dest, 0, 0]
    else array[(d.d_origin + 1) / 2, (d.d_dest + 1) / 2, (d.d_origin + 1) / 2, (d.d_dest + 1) / 2] end;
  -- PENDENTE: mostrar o rótulo de endereço da outra pessoa depois do aceite mútuo
  -- é uma escolha provisória; a política de dados liberados ainda não existe.
  pickup := case choice when 'mine' then im.origin when 'theirs' then io.origin
    else 'Ponto sugerido · entre ' || app_private.lead(im.origin) || ' e ' || app_private.lead(io.origin) end;
  dropoff := case choice when 'mine' then im.destination when 'theirs' then io.destination
    else 'Desembarque sugerido · entre ' || app_private.lead(im.destination) || ' e ' || app_private.lead(io.destination) end;
  return jsonb_build_object(
    'negotiation', n.id,
    'version', n.version,
    'picks', jsonb_build_object(
      'mine', app_private.pick_to_wire(me.pick, viewer),
      'theirs', app_private.pick_to_wire(ot.pick, viewer)),
    'pickup', pickup, 'dropoff', dropoff,
    'departure', app_private.iso(n.departure),
    'stops', '[]'::jsonb,
    'walks', to_jsonb(walks));
end $$;

-- Quatro distâncias de uma escolha estão dentro dos dois limites?
create function app_private.walks_ok(n public.negotiations, viewer uuid, pick text) returns boolean
language plpgsql stable as $$
declare im public.intents; io public.intents; d record; wm int; wd int; wo int; wdd int;
begin
  select i.* into im from public.negotiation_members m join public.intents i on i.id = m.intent_id
    where m.negotiation_id = n.id and m.user_id = viewer;
  select i.* into io from public.negotiation_members m join public.intents i on i.id = m.intent_id
    where m.negotiation_id = n.id and m.user_id <> viewer;
  select * into d from app_private.pair(im, io, '-infinity');
  if pick = viewer::text then wm := 0; wd := 0; wo := d.d_origin; wdd := d.d_dest;
  elsif pick = 'suggestion' then
    wm := (d.d_origin + 1) / 2; wd := (d.d_dest + 1) / 2; wo := wm; wdd := wd;
  else wm := d.d_origin; wd := d.d_dest; wo := 0; wdd := 0; end if;
  return wm <= im.walking_limit and wd <= im.walking_limit
     and wo <= io.walking_limit and wdd <= io.walking_limit;
end $$;

create function app_private.agreed(n public.negotiations) returns boolean
language sql stable as $$
  select count(*) = 2 and count(distinct pick) = 1 and bool_and(pick is not null)
  from public.negotiation_members where negotiation_id = n.id
$$;

-- Reciprocidade: a avaliação recebida só chega ao app depois de a pessoa avaliar.
-- Antes disso, se existe, vai um marcador sem nota (stars 0) para a tela saber
-- que "a outra pessoa já avaliou" sem vazar o conteúdo.
create function app_private.review_json(neg bigint, reviewer uuid, hide boolean) returns jsonb
language sql stable as $$
  select case when r.reviewer is null then null
    when hide then jsonb_build_object('stars', 0, 'comment', '')
    else jsonb_build_object('stars', r.stars, 'comment', r.comment) end
  from (select 1) x left join public.reviews r on r.negotiation_id = neg and r.reviewer = $2
$$;

create function app_private.history_json(uid uuid) returns jsonb
language plpgsql stable as $$
declare result jsonb := '[]'::jsonb; r record; n public.negotiations; other uuid;
  mine_done boolean; w jsonb; name text;
begin
  for r in
    select m.*, (select user_id from public.negotiation_members x
                  where x.negotiation_id = m.negotiation_id and x.user_id <> uid) as other_id
    from public.negotiation_members m
    where m.user_id = uid and m.closed_at is not null
    order by m.closed_at desc, m.negotiation_id desc limit 50
  loop
    select * into n from public.negotiations where id = r.negotiation_id;
    mine_done := exists (select 1 from public.reviews where negotiation_id = r.negotiation_id and reviewer = uid);
    select p.name into name from public.profiles p where p.user_id = r.other_id;
    w := app_private.proposal_json(n, uid);
    result := result || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'negotiation', r.negotiation_id,
      'companion', r.other_id,
      'name', coalesce(name, 'Companhia'),
      'endedAt', app_private.iso(app_private.trip_end(n.departure)),
      'route', app_private.lead(w ->> 'pickup') || ' → ' || app_private.lead(w ->> 'dropoff'),
      'happened', coalesce(r.outcome, false),
      'reason', r.outcome_reason)) || jsonb_build_object(
      'mine', app_private.review_json(r.negotiation_id, uid, false),
      'theirs', app_private.review_json(r.negotiation_id, r.other_id, not mine_done)));
  end loop;
  return result;
end $$;

-- Materializa o que o tempo decide, na leitura: pedidos vencidos ou sem alvo.
-- Nunca depende de tarefa agendada: cada operação revalida o prazo.
create function app_private.advance(uid uuid) returns void
language plpgsql as $$
declare r record;
begin
  perform app_private.lock_users(uid);
  for r in
    select q.id, q.to_user, (ti.status <> 'active') as gone
    from public.requests q
    join public.intents fi on fi.id = q.from_intent
    join public.intents ti on ti.id = q.to_intent
    where q.from_user = uid and q.status = 'pending'
      and (now() >= least(fi.departure, ti.departure) or ti.status <> 'active')
  loop
    update public.requests set status = case when r.gone then 'unavailable' else 'expired' end,
      resolved_at = now() where id = r.id;
    perform app_private.bump(uid, case when r.gone
      then 'A companhia ficou indisponível. Continue vendo sugestões.'
      else 'A solicitação venceu no horário original. Nenhuma viagem foi confirmada.' end);
  end loop;
  perform app_private.expire_negotiation(uid);
end $$;

-- Negociação sem acordo vence no horário combinado (nunca se combina depois da partida).
create function app_private.expire_negotiation(uid uuid) returns void
language plpgsql as $$
declare n public.negotiations;
begin
  select ng.* into n from public.negotiations ng
    join public.negotiation_members m on m.negotiation_id = ng.id
    where m.user_id = uid and m.active and ng.status = 'negotiating' and now() >= ng.departure
      and not app_private.agreed(ng);
  if n.id is not null then
    perform app_private.end_negotiation(n.id, null, 'A combinação venceu no horário da viagem. Nenhuma viagem foi confirmada.');
  end if;
end $$;

-- Estado completo, na visão de `uid`.
create function app_private.snapshot(uid uuid, msg text default null) returns jsonb
language plpgsql as $$
declare
  p public.profiles; i public.intents; us public.user_state; nid bigint; n public.negotiations;
  me public.negotiation_members; other_id uuid; oi public.intents;
  candidates jsonb := '[]'::jsonb; pending text; matched text; proposal jsonb; msgs jsonb := '[]'::jsonb;
  post jsonb; ended timestamptz; notice text;
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

-- Encerra uma negociação antes do fim da viagem. Quem fica volta à busca, se a
-- intenção ainda valer.
create function app_private.end_negotiation(nid bigint, by_user uuid, notice_for_other text) returns void
language plpgsql as $$
declare r record;
begin
  update public.negotiations set status = 'ended', ended_at = now() where id = nid and status <> 'ended';
  for r in select * from public.negotiation_members where negotiation_id = nid loop
    update public.negotiation_members set active = false where negotiation_id = nid and user_id = r.user_id;
    if r.user_id = by_user then
      update public.intents set status = 'closed' where id = r.intent_id;
      perform app_private.bump(r.user_id);
    else
      update public.intents set status = case when departure > now() then 'active' else 'closed' end
        where id = r.intent_id;
      perform app_private.bump(r.user_id, notice_for_other);
      perform app_private.notify(r.user_id, 'negotiation_ended', jsonb_build_object('negotiation', nid));
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------ API pública

-- Leituras ---------------------------------------------------------------------

create function public.app_state(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := app_private.me();
begin
  perform app_private.lock_users(uid);
  return app_private.snapshot(uid);
end $$;

create function public.app_candidates(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := app_private.me();
begin
  perform app_private.lock_users(uid);
  return jsonb_build_object('candidates', app_private.snapshot(uid) -> 'candidates');
end $$;

create function public.app_messages(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := app_private.me();
begin
  return jsonb_build_object('messages', app_private.snapshot(uid) -> 'messages');
end $$;

create function public.app_history(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := app_private.me();
begin
  return jsonb_build_object('history', app_private.history_json(uid));
end $$;

-- Escritas ---------------------------------------------------------------------

create function public.app_profile_save(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'profile_save'; res jsonb;
  pr jsonb; v_email text; v_name text; v_phone text; v_birth date; v_photo boolean;
  auth_email text;
begin
  body := app_private.j_body(body);
  perform app_private.lock_users(uid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  pr := body -> 'profile';
  if pr is null or jsonb_typeof(pr) <> 'object' then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
  v_email := lower(btrim(app_private.j_text(pr, 'email', 254)));
  select lower(email) into auth_email from auth.users where id = uid;
  if v_email is distinct from auth_email then perform app_private.fail('PT403', 'Sem permissão para esta ação.'); end if;
  v_name := regexp_replace(btrim(app_private.j_text(pr, 'name', 200)), '\s+', ' ', 'g');
  if char_length(v_name) not between 2 and 60 then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
  v_phone := regexp_replace(coalesce(app_private.j_text(pr, 'phone', 40, false), ''), '\D', '', 'g');
  if v_phone <> '' and v_phone !~ '^[1-9][0-9]{9,10}$' then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
  begin
    v_birth := app_private.j_text(pr, 'birth', 20)::date;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  -- PENDENTE: idade mínima e necessidade de telefone/foto; só data real e não futura.
  if v_birth > current_date or v_birth < date '1900-01-01' then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  v_photo := case when pr ? 'photo' and jsonb_typeof(pr -> 'photo') <> 'null' then app_private.j_bool(pr, 'photo') else false end;
  insert into public.profiles (user_id, email, name, phone, birth, photo)
  values (uid, v_email, v_name, v_phone, v_birth, v_photo)
  on conflict (user_id) do update
    set name = excluded.name, phone = excluded.phone, birth = excluded.birth,
        photo = excluded.photo, updated_at = now();
  perform app_private.bump(uid);
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_intent_save(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'intent_save'; res jsonb; it jsonb; pts jsonb;
  v_dep timestamptz; v_tz text; v_fixed boolean; v_pax int; v_walk int; v_o text; v_d text;
  olat float8; olon float8; dlat float8; dlon float8;
begin
  body := app_private.j_body(body);
  perform app_private.lock_users(uid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  if not exists (select 1 from public.profiles where user_id = uid) then
    perform app_private.fail('PT403', 'Complete seu cadastro para buscar companhia.');
  end if;
  -- Negociação em andamento é exclusiva: a busca não a substitui.
  if app_private.active_negotiation(uid) is not null then
    return app_private.snapshot(uid, 'Você já tem uma viagem em andamento. Conclua ou cancele antes de buscar de novo.');
  end if;
  it := body -> 'intent';
  if it is null or jsonb_typeof(it) <> 'object' then perform app_private.fail('PT422', 'Confira os dados e tente novamente.'); end if;
  begin
    v_dep := app_private.j_text(it, 'departure', 40)::timestamptz;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  v_tz := app_private.j_text(it, 'timeZone', 64);
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  v_fixed := app_private.j_bool(it, 'fixed');
  v_pax := app_private.j_int(it, 'passengers');
  v_walk := app_private.j_int(it, 'walkingLimit');
  v_o := btrim(app_private.j_text(it, 'origin', 200));
  v_d := btrim(app_private.j_text(it, 'destination', 200));
  if v_dep <= now() or v_pax not between 1 and 2 or v_walk not between 0 and 5000
     or v_o = '' or v_d = '' then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  pts := it -> 'points';
  if pts is not null and jsonb_typeof(pts) not in ('object', 'null') then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  if pts is not null and jsonb_typeof(pts) = 'object' then
    begin
      olat := (pts #>> '{origin,latitude}')::float8; olon := (pts #>> '{origin,longitude}')::float8;
      dlat := (pts #>> '{destination,latitude}')::float8; dlon := (pts #>> '{destination,longitude}')::float8;
    exception when others then
      perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
    end;
    if olat is null or olon is null or dlat is null or dlon is null
       or olat not between -90 and 90 or dlat not between -90 and 90
       or olon not between -180 and 180 or dlon not between -180 and 180
       or (olat = dlat and olon = dlon) then
      perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
    end if;
  elsif v_o = v_d then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  -- Sem limite, repetir buscas com pontos escolhidos permitiria rastrear outras pessoas.
  if (select count(*) from public.intents where user_id = uid and created_at > now() - interval '1 hour') >= 20 then
    perform app_private.fail('PT429', 'Muitas buscas seguidas. Aguarde um pouco.');
  end if;
  -- Uma busca nova substitui a anterior e cancela o pedido pendente.
  update public.requests set status = 'cancelled', resolved_at = now()
    where from_user = uid and status = 'pending';
  update public.intents set status = 'closed' where user_id = uid and status = 'active';
  insert into public.intents (user_id, departure, time_zone, fixed, passengers, walking_limit,
    origin, destination, origin_lat, origin_lon, dest_lat, dest_lon)
  values (uid, v_dep, v_tz, v_fixed, v_pax, v_walk, v_o, v_d, olat, olon, dlat, dlon);
  perform app_private.enqueue_routes(app_private.live_intent(uid));
  perform app_private.bump(uid);
  return app_private.remember(uid, op, body, app_private.snapshot(uid) || jsonb_build_object('skipped', '[]'::jsonb));
end $$;

create function public.app_request_send(jsonb) returns jsonb
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

create function public.app_request_cancel(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1; uid uuid := app_private.me(); op text := 'request_cancel'; res jsonb;
begin
  body := coalesce(body, '{}'::jsonb);
  perform app_private.lock_users(uid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  perform app_private.advance(uid);
  update public.requests set status = 'cancelled', resolved_at = now()
    where from_user = uid and status = 'pending';
  if found then
    perform app_private.bump(uid, 'Solicitação cancelada. Você pode continuar buscando.');
  end if;
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

-- Valida participação e trava as duas pessoas + a negociação, em ordem estável.
create function app_private.enter_negotiation(uid uuid, nid bigint) returns public.negotiations
language plpgsql as $$
declare other uuid; n public.negotiations;
begin
  select user_id into other from public.negotiation_members
    where negotiation_id = nid and user_id <> uid;
  if not exists (select 1 from public.negotiation_members where negotiation_id = nid and user_id = uid)
     or other is null then
    perform app_private.fail('PT404', 'Não encontrado.');
  end if;
  perform app_private.lock_users(uid, other);
  select * into n from public.negotiations where id = nid for update;
  return n;
end $$;

create function public.app_proposal_pick(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'proposal_pick'; res jsonb;
  nid bigint; expected bigint; choice text; stop text; n public.negotiations;
  me public.negotiation_members; abs_pick text; other uuid;
begin
  body := app_private.j_body(body);
  nid := app_private.j_int(body, 'negotiation');
  expected := app_private.j_int(body, 'expectedVersion');
  choice := app_private.j_text(body, 'choice', 20);
  stop := app_private.j_text(body, 'stop', 200, false);
  n := app_private.enter_negotiation(uid, nid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  select * into me from public.negotiation_members where negotiation_id = nid and user_id = uid;
  if n.status <> 'negotiating' or not me.active then
    perform app_private.fail('PT409', 'Algo mudou. Confira a viagem antes de continuar.');
  end if;
  if app_private.agreed(n) and now() >= app_private.trip_end(n.departure) then
    perform app_private.fail('PT409', 'Esta viagem já terminou.');
  end if;
  if n.version <> expected then
    perform app_private.fail('PT409', 'A proposta mudou. Confira a versão atual antes de continuar.');
  end if;
  if choice not in ('suggestion', 'mine', 'theirs') then
    -- PENDENTE: paradas intermediárias dependem de pontos e rotas reais (etapa 6).
    perform app_private.fail('PT422', 'Esta opção ainda não está disponível.');
  end if;
  select user_id into other from public.negotiation_members where negotiation_id = nid and user_id <> uid;
  abs_pick := case choice when 'suggestion' then 'suggestion' when 'mine' then uid::text else other::text end;
  if not app_private.walks_ok(n, uid, abs_pick) then
    perform app_private.fail('PT422', 'Esta opção ultrapassa um limite de caminhada. Escolha outro trajeto.');
  end if;
  if me.pick is not distinct from abs_pick then
    return app_private.remember(uid, op, body, app_private.snapshot(uid));
  end if;
  update public.negotiation_members set pick = abs_pick where negotiation_id = nid and user_id = uid;
  update public.negotiations set version = version + 1 where id = nid;
  select * into n from public.negotiations where id = nid;
  perform app_private.bump(uid);
  perform app_private.bump(other);
  perform app_private.notify(other, case when app_private.agreed(n) then 'agreed' else 'proposal_changed' end,
    jsonb_build_object('negotiation', nid));
  return app_private.remember(uid, op, body, app_private.snapshot(uid,
    case when app_private.agreed(n) then 'Vocês escolheram a mesma opção. Viagem combinada.'
         else 'Escolha registrada. Aguardando a outra pessoa escolher a mesma opção.' end));
end $$;

create function public.app_message_send(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'message_send'; res jsonb;
  nid bigint; text_body text; n public.negotiations; other uuid;
begin
  body := app_private.j_body(body);
  nid := app_private.j_int(body, 'negotiation');
  text_body := btrim(app_private.j_text(body, 'text', 2000));
  n := app_private.enter_negotiation(uid, nid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  if text_body = '' or char_length(text_body) > 1000 then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  if n.status <> 'negotiating'
     or not exists (select 1 from public.negotiation_members where negotiation_id = nid and user_id = uid and active)
     or (app_private.agreed(n) and now() >= app_private.trip_end(n.departure)) then
    perform app_private.fail('PT409', 'Algo mudou. Confira a viagem antes de continuar.');
  end if;
  insert into public.messages (negotiation_id, sender, body) values (nid, uid, text_body);
  select user_id into other from public.negotiation_members where negotiation_id = nid and user_id <> uid;
  perform app_private.notify(other, 'message', jsonb_build_object('negotiation', nid));
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_negotiation_end(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'negotiation_end'; res jsonb; nid bigint; n public.negotiations;
begin
  body := app_private.j_body(body);
  nid := app_private.j_int(body, 'negotiation');
  n := app_private.enter_negotiation(uid, nid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  if n.status <> 'negotiating'
     or not exists (select 1 from public.negotiation_members where negotiation_id = nid and user_id = uid and active)
     or (app_private.agreed(n) and now() >= app_private.trip_end(n.departure)) then
    perform app_private.fail('PT409', 'Algo mudou. Confira a viagem antes de continuar.');
  end if;
  -- PENDENTE: regra de cancelamento depois do acordo (aviso, reputação).
  perform app_private.end_negotiation(nid, uid, 'A outra pessoa cancelou a participação. Você pode buscar de novo.');
  return app_private.remember(uid, op, body, app_private.snapshot(uid,
    'Sua participação foi cancelada. A outra pessoa foi avisada.'));
end $$;

create function public.app_trip_outcome(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'trip_outcome'; res jsonb; nid bigint;
  happened boolean; reason text; n public.negotiations; me public.negotiation_members;
begin
  body := app_private.j_body(body);
  nid := app_private.j_int(body, 'negotiation');
  happened := app_private.j_bool(body, 'happened');
  reason := app_private.j_text(body, 'reason', 20, false);
  n := app_private.enter_negotiation(uid, nid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  select * into me from public.negotiation_members where negotiation_id = nid and user_id = uid;
  if not me.active or n.status <> 'negotiating' or not app_private.agreed(n)
     or now() < app_private.trip_end(n.departure) or me.outcome is not null then
    perform app_private.fail('PT409', 'Algo mudou. Confira a viagem antes de continuar.');
  end if;
  if not happened and reason is null or reason is not null
     and reason not in ('no-show', 'could-not-go', 'agreed-cancel', 'no-car', 'other') then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  update public.negotiation_members
    set outcome = happened, outcome_reason = case when happened then null else reason end
    where negotiation_id = nid and user_id = uid;
  perform app_private.bump(uid);
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_review_send(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'review_send'; res jsonb; nid bigint;
  v_stars bigint; v_comment text; n public.negotiations; me public.negotiation_members; other uuid;
begin
  body := app_private.j_body(body);
  nid := app_private.j_int(body, 'negotiation');
  v_stars := app_private.j_int(body, 'stars');
  v_comment := btrim(coalesce(app_private.j_text(body, 'comment', 1000, false), ''));
  n := app_private.enter_negotiation(uid, nid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  select * into me from public.negotiation_members where negotiation_id = nid and user_id = uid;
  if not me.active or me.outcome is not true
     or exists (select 1 from public.reviews where negotiation_id = nid and reviewer = uid) then
    perform app_private.fail('PT409', 'Algo mudou. Confira a viagem antes de continuar.');
  end if;
  if v_stars not between 1 and 5 or char_length(v_comment) > 500
     or (v_stars < 3 and v_comment = '') then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  select user_id into other from public.negotiation_members where negotiation_id = nid and user_id <> uid;
  insert into public.reviews (negotiation_id, reviewer, reviewee, stars, comment)
  values (nid, uid, other, v_stars, v_comment);
  perform app_private.bump(uid);
  perform app_private.bump(other);
  perform app_private.notify(other, 'reviewed', jsonb_build_object('negotiation', nid));
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_trip_close(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'trip_close'; res jsonb; nid bigint;
  n public.negotiations; me public.negotiation_members;
begin
  body := app_private.j_body(body);
  nid := app_private.j_int(body, 'negotiation');
  n := app_private.enter_negotiation(uid, nid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  select * into me from public.negotiation_members where negotiation_id = nid and user_id = uid;
  if not me.active or me.outcome is null then
    perform app_private.fail('PT409', 'Algo mudou. Confira a viagem antes de continuar.');
  end if;
  update public.negotiation_members set active = false, closed_at = now()
    where negotiation_id = nid and user_id = uid;
  update public.intents set status = 'closed' where id = me.intent_id;
  if not exists (select 1 from public.negotiation_members where negotiation_id = nid and active) then
    update public.negotiations set status = 'ended', ended_at = now() where id = nid;
  end if;
  perform app_private.bump(uid);
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

-- Quem pode denunciar/bloquear: só quem já esteve numa negociação com a pessoa.
create function app_private.knows(uid uuid, other uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.negotiation_members a
    join public.negotiation_members b on b.negotiation_id = a.negotiation_id and b.user_id = other
    where a.user_id = uid)
$$;

create function public.app_report_send(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'report_send'; res jsonb;
  other uuid; reason text; details text;
begin
  body := app_private.j_body(body);
  begin
    other := app_private.j_text(body, 'companionId', 100)::uuid;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  reason := app_private.j_text(body, 'reason', 20);
  details := btrim(coalesce(app_private.j_text(body, 'details', 1000, false), ''));
  perform app_private.lock_users(uid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  if reason not in ('behavior', 'unsafe', 'fake', 'payment', 'other')
     or (reason = 'other' and details = '') then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end if;
  if other = uid or not app_private.knows(uid, other) then
    perform app_private.fail('PT403', 'Sem permissão para esta ação.');
  end if;
  -- PENDENTE: critérios de moderação e contestação; a denúncia só fica registrada.
  insert into public.reports (reporter, reported, reason, details) values (uid, other, reason, details);
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_block_add(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1;
  uid uuid := app_private.me(); op text := 'block_add'; res jsonb; other uuid; nid bigint; n public.negotiations;
begin
  body := app_private.j_body(body);
  begin
    other := app_private.j_text(body, 'companionId', 100)::uuid;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  -- Antes de travar: desconhecido e inexistente recebem o mesmo erro (sem sondar contas).
  if other = uid or not app_private.knows(uid, other) then
    perform app_private.fail('PT403', 'Sem permissão para esta ação.');
  end if;
  perform app_private.lock_users(uid, other);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  insert into public.blocks (blocker, blocked) values (uid, other) on conflict do nothing;
  -- Bloquear encerra a negociação aberta com a pessoa (depois da viagem não impede avaliar).
  select m.negotiation_id into nid from public.negotiation_members m
    join public.negotiation_members o on o.negotiation_id = m.negotiation_id and o.user_id = other
    where m.user_id = uid and m.active and o.active limit 1;
  if nid is not null then
    select * into n from public.negotiations where id = nid for update;
    if not (app_private.agreed(n) and now() >= app_private.trip_end(n.departure)) then
      perform app_private.end_negotiation(nid, uid, 'A outra pessoa cancelou a participação. Você pode buscar de novo.');
    end if;
  end if;
  update public.requests set status = 'cancelled', resolved_at = now()
    where status = 'pending' and ((from_user = uid and to_user = other) or (from_user = other and to_user = uid));
  perform app_private.bump(uid);
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

create function public.app_block_remove(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  body jsonb := $1; uid uuid := app_private.me(); op text := 'block_remove'; res jsonb; other uuid;
begin
  body := app_private.j_body(body);
  begin
    other := app_private.j_text(body, 'companionId', 100)::uuid;
  exception when others then
    perform app_private.fail('PT422', 'Confira os dados e tente novamente.');
  end;
  perform app_private.lock_users(uid);
  res := app_private.replay(uid, op, body);
  if res is not null then return res; end if;
  delete from public.blocks where blocker = uid and blocked = other;
  return app_private.remember(uid, op, body, app_private.snapshot(uid));
end $$;

-- Worker de rotas (chave service_role, só no servidor) --------------------------

create function public.worker_route_pending(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := least(greatest(coalesce(($1 ->> 'limit')::int, 20), 1), 100); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'a', jsonb_build_object('lat', q.a_lat, 'lon', q.a_lon),
      'b', jsonb_build_object('lat', q.b_lat, 'lon', q.b_lon))), '[]'::jsonb)
  into result from (
    select * from public.route_queue where attempts < 5
    order by requested_at limit n for update skip locked) q;
  return result;
end $$;

create function public.worker_route_store(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare b jsonb := $1; a1 numeric(8,5); o1 numeric(8,5); a2 numeric(8,5); o2 numeric(8,5);
  t1 numeric(8,5); t2 numeric(8,5); m integer; ml numeric(8,5); mo numeric(8,5);
begin
  a1 := round((b #>> '{a,lat}')::numeric, 5); o1 := round((b #>> '{a,lon}')::numeric, 5);
  a2 := round((b #>> '{b,lat}')::numeric, 5); o2 := round((b #>> '{b,lon}')::numeric, 5);
  m := (b ->> 'meters')::integer;
  ml := round((b #>> '{mid,lat}')::numeric, 5); mo := round((b #>> '{mid,lon}')::numeric, 5);
  if (a1, o1) > (a2, o2) then
    t1 := a1; t2 := o1; a1 := a2; o1 := o2; a2 := t1; o2 := t2;
  end if;
  if m is null or m < 0 or m > 100000 or ml is null or mo is null then
    perform app_private.fail('PT422', 'Rota inválida.');
  end if;
  insert into public.walk_routes (a_lat, a_lon, b_lat, b_lon, meters, mid_lat, mid_lon, provider)
  values (a1, o1, a2, o2, m, ml, mo, coalesce(left(b ->> 'provider', 40), 'desconhecido'))
  on conflict (a_lat, a_lon, b_lat, b_lon) do update
    set meters = excluded.meters, mid_lat = excluded.mid_lat, mid_lon = excluded.mid_lon,
        provider = excluded.provider, fetched_at = now();
  delete from public.route_queue where a_lat = a1 and a_lon = o1 and b_lat = a2 and b_lon = o2;
  return jsonb_build_object('stored', true);
end $$;

create function public.worker_route_fail(jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare b jsonb := $1;
begin
  update public.route_queue set attempts = attempts + 1, last_error = left(coalesce(b ->> 'error', ''), 200)
  where a_lat = round((b #>> '{a,lat}')::numeric, 5) and a_lon = round((b #>> '{a,lon}')::numeric, 5)
    and b_lat = round((b #>> '{b,lat}')::numeric, 5) and b_lon = round((b #>> '{b,lon}')::numeric, 5);
  return jsonb_build_object('failed', true);
end $$;

-- ------------------------------------------------------------------ permissões

-- Funções nascem executáveis por PUBLIC: fechar tudo e abrir só a API.
revoke all on all functions in schema app_private from public, anon, authenticated;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname like 'app\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  -- O worker usa a chave service_role (só no servidor), nunca o app.
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname like 'worker\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
