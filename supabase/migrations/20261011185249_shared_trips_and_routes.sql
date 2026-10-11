-- Shared trips. Privileged helpers live outside the exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  start_date date, end_date date,
  budget_total double precision not null default 20000 check (budget_total >= 0 and budget_total < 'Infinity'::float8),
  travelers integer not null default 2 check (travelers > 0),
  vehicle_mpg double precision not null default 28 check (vehicle_mpg > 0 and vehicle_mpg < 'Infinity'::float8),
  cold_threshold_f double precision not null default 45 check (abs(cold_threshold_f) < 'Infinity'::float8),
  default_nightly_rate double precision not null default 90 check (default_nightly_rate >= 0 and default_nightly_rate < 'Infinity'::float8),
  manual_order boolean not null default false,
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members(user_id);
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  state text not null default '',
  arrive_date date not null, depart_date date not null,
  nightly_rate double precision check (nightly_rate >= 0 and nightly_rate < 'Infinity'::float8),
  weather jsonb,
  position integer not null default 0 check (position >= 0),
  updated_at timestamptz not null default now(),
  check (depart_date >= arrive_date)
);
create index stops_trip_idx on public.stops(trip_id, position);
create table public.invites (
  code uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index invites_trip_idx on public.invites(trip_id);
create table public.legs (
  trip_id uuid not null references public.trips(id) on delete cascade,
  coordinate_key text not null,
  data jsonb,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (trip_id, coordinate_key)
);

create function private.is_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.trip_members where trip_id = target and user_id = auth.uid()
  );
$$;
create function private.is_owner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.trip_members where trip_id = target and user_id = auth.uid() and role = 'owner'
  );
$$;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.stops enable row level security;
alter table public.invites enable row level security;
alter table public.legs enable row level security;

revoke all on public.trips, public.trip_members, public.stops, public.invites, public.legs from anon, authenticated;
grant select on public.trips, public.trip_members, public.invites, public.legs to authenticated;
grant update(name, start_date, end_date, budget_total, travelers, vehicle_mpg, cold_threshold_f, default_nightly_rate, manual_order) on public.trips to authenticated;
grant select, insert, update, delete on public.stops to authenticated;
grant insert, delete on public.invites to authenticated;
grant all on public.trips, public.trip_members, public.stops, public.invites, public.legs to service_role;

create policy trip_read on public.trips for select to authenticated using ((select private.is_member(id)));
create policy trip_edit on public.trips for update to authenticated using ((select private.is_member(id))) with check ((select private.is_member(id)));
create policy members_read on public.trip_members for select to authenticated using ((select private.is_member(trip_id)));
create policy stops_read on public.stops for select to authenticated using ((select private.is_member(trip_id)));
create policy stops_add on public.stops for insert to authenticated with check ((select private.is_member(trip_id)));
create policy stops_edit on public.stops for update to authenticated using ((select private.is_member(trip_id))) with check ((select private.is_member(trip_id)));
create policy stops_delete on public.stops for delete to authenticated using ((select private.is_member(trip_id)));
create policy invites_read on public.invites for select to authenticated using ((select private.is_owner(trip_id)));
create policy invites_add on public.invites for insert to authenticated with check ((select private.is_owner(trip_id)) and expires_at > now() and expires_at <= now() + interval '7 days');
create policy invites_delete on public.invites for delete to authenticated using ((select private.is_owner(trip_id)));
create policy legs_read on public.legs for select to authenticated using ((select private.is_member(trip_id)));

create function private.validate_change() returns trigger language plpgsql set search_path = '' as $$
declare t public.trips;
begin
  if tg_table_name = 'trips' then
    if new.id <> old.id or new.owner_id <> old.owner_id then raise exception 'Trip identity cannot change'; end if;
    if exists (select 1 from public.stops where trip_id = new.id and
      ((new.start_date is not null and arrive_date < new.start_date) or (new.end_date is not null and depart_date > new.end_date)))
      then raise exception 'Trip dates exclude an existing stop'; end if;
  else
    if tg_op = 'UPDATE' and (new.id <> old.id or new.trip_id <> old.trip_id) then raise exception 'Stop identity cannot change'; end if;
    select * into t from public.trips where id = new.trip_id for share;
    if t.id is null or (t.start_date is not null and new.arrive_date < t.start_date) or (t.end_date is not null and new.depart_date > t.end_date)
      then raise exception 'Stop must fall within the trip dates'; end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger trip_change before update on public.trips for each row execute function private.validate_change();
create trigger stop_change before insert or update on public.stops for each row execute function private.validate_change();

create function private.create_trip(input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid; s jsonb; i integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if jsonb_array_length(coalesce(input->'stops', '[]'::jsonb)) > 200 then raise exception 'Maximum 200 stops'; end if;
  insert into public.trips(owner_id, name, start_date, end_date, budget_total, travelers, vehicle_mpg, cold_threshold_f, default_nightly_rate, manual_order)
  values (auth.uid(), input->>'name', nullif(input->>'startDate','')::date, nullif(input->>'endDate','')::date,
    (input->>'budgetTotal')::float8, (input->>'travelers')::integer, (input->>'vehicleMpg')::float8,
    (input->>'coldThresholdF')::float8, (input->>'defaultNightlyRate')::float8, coalesce((input->>'manualOrder')::boolean,false)) returning id into target;
  insert into public.trip_members values (target, auth.uid(), 'owner');
  for s in select value from jsonb_array_elements(coalesce(input->'stops','[]'::jsonb)) loop
    insert into public.stops(trip_id,name,lat,lon,state,arrive_date,depart_date,nightly_rate,weather,position)
    values (target,s->>'name',(s->>'lat')::float8,(s->>'lon')::float8,coalesce(s->>'state',''),
      (s->>'arriveDate')::date,(s->>'departDate')::date,(s->>'nightlyRate')::float8,s->'weather',i);
    i := i + 1;
  end loop;
  return target;
end;
$$;
create function public.create_trip(input jsonb) returns uuid language sql security invoker set search_path = '' as $$ select private.create_trip(input); $$;

create function private.join_trip(invite_code uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select trip_id into target from public.invites where code = invite_code and expires_at > now() for share;
  if target is null then raise exception 'This invite is invalid or expired'; end if;
  insert into public.trip_members values (target, auth.uid(), 'editor') on conflict do nothing;
  return target;
end;
$$;
create function public.join_trip(invite_code uuid) returns uuid language sql security invoker set search_path = '' as $$ select private.join_trip(invite_code); $$;

create function public.order_stops(target uuid, ordered_ids uuid[], manual boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_member(target) then raise exception 'Trip not found'; end if;
  perform 1 from public.trips where id = target for update;
  if cardinality(ordered_ids) <> (select count(*) from public.stops where trip_id = target)
    or (select count(distinct x) from unnest(ordered_ids) x) <> cardinality(ordered_ids)
    or exists (select 1 from unnest(ordered_ids) x where not exists (select 1 from public.stops where id = x and trip_id = target))
    then raise exception 'Stops changed on another device. Please retry.'; end if;
  update public.stops s set position = x.ordinality - 1 from unnest(ordered_ids) with ordinality x(id,ordinality) where s.id = x.id and s.trip_id = target;
  update public.trips set manual_order = manual where id = target;
end;
$$;

-- A short database lease ensures concurrent phones don't both call ORS.
create function private.claim_leg(target uuid, key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.legs; token uuid;
begin
  if not private.is_member(target) then raise exception 'Trip not found'; end if;
  if length(key) > 160 then raise exception 'Invalid coordinate key'; end if;
  insert into public.legs(trip_id,coordinate_key) values(target,key) on conflict do nothing;
  select * into r from public.legs where trip_id = target and coordinate_key = key for update;
  if r.data is not null then return jsonb_build_object('status','ready','data',r.data); end if;
  if r.lease_until > now() then return jsonb_build_object('status','pending'); end if;
  token := gen_random_uuid();
  update public.legs set lease_token = token, lease_until = now() + interval '45 seconds' where trip_id = target and coordinate_key = key;
  return jsonb_build_object('status','claimed','token',token);
end;
$$;
create function public.claim_leg(target uuid, key text) returns jsonb language sql security invoker set search_path = '' as $$ select private.claim_leg(target,key); $$;
create function private.finish_leg(target uuid, key text, token uuid, result jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member(target) then raise exception 'Trip not found'; end if;
  update public.legs set data = result, lease_token = null, lease_until = null, updated_at = now()
    where trip_id = target and coordinate_key = key and lease_token = token;
  return found;
end;
$$;
create function public.finish_leg(target uuid, key text, token uuid, result jsonb) returns boolean language sql security invoker set search_path = '' as $$ select private.finish_leg(target,key,token,result); $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_owner(uuid), private.create_trip(jsonb), private.join_trip(uuid), private.claim_leg(uuid,text), private.finish_leg(uuid,text,uuid,jsonb) to authenticated;
revoke all on function public.create_trip(jsonb), public.join_trip(uuid), public.order_stops(uuid,uuid[],boolean), public.claim_leg(uuid,text), public.finish_leg(uuid,text,uuid,jsonb) from public, anon;
grant execute on function public.create_trip(jsonb), public.join_trip(uuid), public.order_stops(uuid,uuid[],boolean), public.claim_leg(uuid,text), public.finish_leg(uuid,text,uuid,jsonb) to authenticated;

-- Broadcast row changes; do not modify Supabase's locked-down realtime schema.
alter publication supabase_realtime add table public.trips, public.stops;
notify pgrst, 'reload schema';
