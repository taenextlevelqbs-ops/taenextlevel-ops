-- Apply ONLY to a new, dedicated Command Center Supabase project.
-- No application data, passwords, credential values, or PHI is stored here.
begin;
create table if not exists public.command_sites (
  id text primary key check(id ~ '^[a-z][a-z0-9-]{1,59}$'),
  config jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.command_uptime (
  id bigint generated always as identity primary key,
  site_id text not null,
  status text not null check(status in ('up','down','unknown')),
  http_status integer,
  response_ms integer check(response_ms >= 0),
  checked_at timestamptz not null default now()
);
create index if not exists command_uptime_site_time on public.command_uptime(site_id,checked_at desc);
create table if not exists public.command_daily_metrics (
  site_id text not null,
  day date not null,
  metrics jsonb not null,
  captured_at timestamptz not null default now(),
  primary key(site_id,day)
);
create table if not exists public.command_auth_limits (
  bucket text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
alter table public.command_sites enable row level security;
alter table public.command_uptime enable row level security;
alter table public.command_auth_limits enable row level security;
alter table public.command_daily_metrics enable row level security;
revoke all on public.command_sites,public.command_uptime,public.command_auth_limits,public.command_daily_metrics from anon,authenticated;
grant all on public.command_sites,public.command_uptime,public.command_auth_limits,public.command_daily_metrics to service_role;
grant usage, select on sequence public.command_uptime_id_seq to service_role;
create or replace function public.command_login_attempt(bucket text) returns boolean
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 insert into public.command_auth_limits as limits(bucket,attempts,expires_at)
 values(command_login_attempt.bucket,1,now()+interval '15 minutes')
 on conflict on constraint command_auth_limits_pkey do update set
   attempts=case when limits.expires_at <= now() then 1 else limits.attempts+1 end,
   expires_at=case when limits.expires_at <= now() then now()+interval '15 minutes' else limits.expires_at end
 returning attempts into total;
 return total <= 8;
end;
$$;
revoke all on function public.command_login_attempt(text) from public,anon,authenticated;
grant execute on function public.command_login_attempt(text) to service_role;
commit;
-- Configure retention separately if desired; do not delete historical samples during startup.
