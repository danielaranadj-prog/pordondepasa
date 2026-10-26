-- New account data only. Does not modify routes, stops, places or advertising.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table app_private.account_allowlist (
  email text primary key check (email = lower(trim(email))),
  enabled boolean not null default true
);
revoke all on app_private.account_allowlist from public, anon, authenticated;

-- Never trust browser email, user_metadata or a client-provided owner ID.
create function app_private.account_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join app_private.account_allowlist a on a.email = lower(u.email) and a.enabled
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
    and u.raw_app_meta_data->>'provider' = 'google'
  );
$$;
revoke all on function app_private.account_allowed() from public, anon;
grant execute on function app_private.account_allowed() to authenticated;

create function public.account_access() returns boolean
language sql stable security invoker set search_path = '' as $$
  select app_private.account_allowed();
$$;
revoke all on function public.account_access() from public, anon;
grant execute on function public.account_access() to authenticated;

create table public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.account_saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('home','work')),
  label text not null check (length(trim(label)) between 1 and 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now(),
  primary key(user_id,kind)
);
create table public.account_favorite_routes (
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id text not null check (length(route_id) between 1 and 120 and route_id ~ '^[a-zA-Z0-9_-]+$'),
  created_at timestamptz not null default now(),
  primary key(user_id,route_id)
);

create function app_private.account_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function app_private.account_updated_at() from public, anon, authenticated;
create trigger account_profiles_updated before update on public.account_profiles
for each row execute function app_private.account_updated_at();
create trigger account_places_updated before update on public.account_saved_places
for each row execute function app_private.account_updated_at();

alter table public.account_profiles enable row level security;
alter table public.account_saved_places enable row level security;
alter table public.account_favorite_routes enable row level security;
revoke all on public.account_profiles, public.account_saved_places, public.account_favorite_routes from public, anon, authenticated;
grant select, insert, update, delete on public.account_profiles, public.account_saved_places, public.account_favorite_routes to authenticated;

-- USING protects existing rows; WITH CHECK protects inserts and ownership changes.
create policy account_profiles_owner on public.account_profiles to authenticated
using ((select auth.uid()) = user_id and (select app_private.account_allowed()))
with check ((select auth.uid()) = user_id and (select app_private.account_allowed()));
create policy account_places_owner on public.account_saved_places to authenticated
using ((select auth.uid()) = user_id and (select app_private.account_allowed()))
with check ((select auth.uid()) = user_id and (select app_private.account_allowed()));
create policy account_favorites_owner on public.account_favorite_routes to authenticated
using ((select auth.uid()) = user_id and (select app_private.account_allowed()))
with check ((select auth.uid()) = user_id and (select app_private.account_allowed()));

-- Atomic erasure of app data, NOT deletion of the Google or Supabase identity.
create function public.account_clear_data() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not app_private.account_allowed() then raise exception 'Access denied' using errcode = '42501'; end if;
  delete from public.account_saved_places where user_id = (select auth.uid());
  delete from public.account_favorite_routes where user_id = (select auth.uid());
  delete from public.account_profiles where user_id = (select auth.uid());
end;
$$;
revoke all on function public.account_clear_data() from public, anon;
grant execute on function public.account_clear_data() to authenticated;

-- Optional Before User Created hook. Enable in Auth settings when activating pilot.
create function app_private.before_account_created(event jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if event->'user'->'app_metadata'->>'provider' = 'google'
     and exists (select 1 from app_private.account_allowlist
       where email = lower(event->'user'->>'email') and enabled) then
    return '{}'::jsonb;
  end if;
  return '{"error":{"http_code":403,"message":"Este piloto requiere una cuenta de Google autorizada."}}'::jsonb;
end;
$$;
revoke all on function app_private.before_account_created(jsonb) from public, anon, authenticated;
grant usage on schema app_private to supabase_auth_admin;
grant select on app_private.account_allowlist to supabase_auth_admin;
grant execute on function app_private.before_account_created(jsonb) to supabase_auth_admin;
-- Empty allowlist intentionally denies everyone. Add the pilot email server-side,
-- never as PUBLIC_* configuration or a browser authorization check.
