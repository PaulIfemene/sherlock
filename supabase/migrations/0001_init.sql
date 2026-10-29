-- Sherlock schema. CLAUDE.md section 7, plus progress/reply columns, events, settings and invites.
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Journalists -------------------------------------------------------------------------------------
create table if not exists journalists (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  newsroom text not null,
  email text not null,
  receives_alerts boolean default true,
  created_at timestamptz default now()
);

-- Emails allowed to become journalists on their first magic-link sign-in.
create table if not exists journalist_invites (
  email text primary key,
  display_name text not null default 'Demo Reporter',
  newsroom text not null default 'Sample Newsroom',
  created_at timestamptz default now()
);

-- Senders (analytics-safe) and reply addresses (service role only) ---------------------------------
create table if not exists senders (
  sender_hash text primary key,                        -- HMAC-SHA256(PHONE_HASH_SECRET, e164)
  language_pref text check (language_pref in ('eng','lug','swa')),
  consent_version text,
  consent_at timestamptz,
  opted_out boolean default false,
  last_message_at timestamptz
);

create table if not exists reply_addresses (
  sender_hash text primary key references senders(sender_hash) on delete cascade,
  channel text not null check (channel in ('whatsapp','web')),
  address_ciphertext text not null,                    -- AES-256-GCM, base64
  iv text not null,
  tag text not null
);

-- Clusters and claims ----------------------------------------------------------------------------
create table if not exists clusters (
  id uuid primary key default gen_random_uuid(),
  canonical_text_en text not null,
  embedding vector(1024),
  report_count int default 0,
  simulated_reports int default 0,                     -- part of report_count added by "Simulate spread (demo)"
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  status text default 'open' check (status in ('open','published')),
  is_demo boolean default false
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id) on delete cascade,
  sender_hash text references senders(sender_hash) on delete set null,
  channel text not null check (channel in ('whatsapp','web')),
  original_text text,
  original_language text,
  text_en text,
  image_path text,                                     -- storage path, deleted within 24 hours
  image_phash text,
  ocr_text text,
  ai_label text check (ai_label in ('likely_false','likely_true','missing_context','under_investigation','unverified')),
  ai_confidence real,
  ai_rationale text,
  ai_reply_en text,
  evidence jsonb default '[]',
  status text default 'received' check (status in ('received','assessed','queued','published')),
  progress text default 'received',
  reply_text text,
  reply_language text,
  received_at timestamptz default now(),
  is_demo boolean default false
);
create index if not exists claims_cluster_idx on claims(cluster_id);
create index if not exists claims_received_idx on claims(received_at desc);
create index if not exists claims_sender_idx on claims(sender_hash);

create table if not exists cluster_counts (
  cluster_id uuid references clusters(id) on delete cascade,
  bucket timestamptz not null,                         -- 5-minute buckets
  count int not null,
  primary key (cluster_id, bucket)
);

create table if not exists verdicts (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id) on delete cascade unique,
  label text not null check (label in ('likely_false','likely_true','missing_context','under_investigation','unverified')),
  explanation_en text not null,
  explanation_lug text,
  explanation_swa text,
  source_url text,
  journalist_id uuid references journalists(id),
  published_at timestamptz default now()
);

-- Official sources -------------------------------------------------------------------------------
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  kind text check (kind in ('rss','page')),
  selector text,
  interval_minutes int default 60,
  trusted_because text,
  enabled boolean default true,
  last_success_at timestamptz,
  last_error text,
  last_checked_at timestamptz
);

create table if not exists source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  title text,
  url text unique,
  published_at timestamptz,
  content_text text,
  embedding vector(1024),
  fetched_at timestamptz default now()
);

-- Alerts, outbound queue, events, settings ----------------------------------------------------------
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id) on delete cascade,
  sent_to text[],
  sent_at timestamptz default now(),
  delivery text default 'sent' check (delivery in ('sent','simulated','failed')),
  error text,
  is_demo boolean default false
);

create table if not exists outbound_queue (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  status text default 'pending' check (status in ('pending','sent','needs_template','failed')),
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id) on delete cascade,
  claim_id uuid references claims(id) on delete cascade,
  kind text not null,
  detail text not null,
  actor text,
  created_at timestamptz default now()
);
create index if not exists events_cluster_idx on events(cluster_id, created_at desc);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
insert into settings(key, value) values
  ('rising_threshold', '20'::jsonb),
  ('alert_emails', '[]'::jsonb)
on conflict (key) do nothing;

-- Functions --------------------------------------------------------------------------------------
create or replace function is_journalist() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from journalists where id = auth.uid())
$$;

-- Create the journalist row when an invited email signs in for the first time.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv journalist_invites%rowtype;
begin
  select * into inv from journalist_invites where lower(email) = lower(new.email);
  if found then
    insert into journalists(id, display_name, newsroom, email)
    values (new.id, inv.display_name, inv.newsroom, new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Atomic report count: bump the cluster and its 5-minute bucket, return before/after.
create or replace function bump_cluster(p_cluster uuid, p_by int default 1, p_at timestamptz default now(), p_simulated boolean default false)
returns table(before_count int, after_count int)
language plpgsql security definer set search_path = public as $$
declare b int; a int;
begin
  update clusters
     set report_count = report_count + p_by,
         simulated_reports = simulated_reports + case when p_simulated then p_by else 0 end,
         last_seen = greatest(last_seen, p_at)
   where id = p_cluster
  returning report_count - p_by, report_count into b, a;
  insert into cluster_counts(cluster_id, bucket, count)
  values (p_cluster, to_timestamp(floor(extract(epoch from p_at) / 300) * 300), p_by)
  on conflict (cluster_id, bucket) do update set count = cluster_counts.count + excluded.count;
  return query select b, a;
end $$;

create or replace function cluster_velocity(p_cluster uuid, p_now timestamptz default now())
returns table(last_hour int, prev_hour int)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(count) filter (where bucket > p_now - interval '1 hour'), 0)::int,
    coalesce(sum(count) filter (where bucket <= p_now - interval '1 hour' and bucket > p_now - interval '2 hours'), 0)::int
  from cluster_counts where cluster_id = p_cluster and bucket <= p_now
$$;

create or replace function match_clusters(query_embedding vector(1024), match_threshold float, match_count int default 1)
returns table(id uuid, canonical_text_en text, status text, report_count int, similarity float)
language sql stable security definer set search_path = public as $$
  select c.id, c.canonical_text_en, c.status, c.report_count, 1 - (c.embedding <=> query_embedding) as similarity
  from clusters c
  where c.embedding is not null and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count
$$;

create or replace function match_source_items(query_embedding vector(1024), match_threshold float, match_count int default 4)
returns table(id uuid, title text, url text, content_text text, published_at timestamptz, source_name text, similarity float)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.url, i.content_text, i.published_at, s.name, 1 - (i.embedding <=> query_embedding) as similarity
  from source_items i join sources s on s.id = i.source_id
  where i.embedding is not null and 1 - (i.embedding <=> query_embedding) >= match_threshold
  order by i.embedding <=> query_embedding
  limit match_count
$$;

revoke execute on function bump_cluster(uuid, int, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function match_clusters(vector, float, int) from public, anon, authenticated;
revoke execute on function match_source_items(vector, float, int) from public, anon, authenticated;
revoke execute on function cluster_velocity(uuid, timestamptz) from public, anon;
grant execute on function bump_cluster(uuid, int, timestamptz, boolean) to service_role;
grant execute on function match_clusters(vector, float, int) to service_role;
grant execute on function match_source_items(vector, float, int) to service_role;

-- Row-level security -----------------------------------------------------------------------------
alter table journalists enable row level security;
alter table journalist_invites enable row level security;
alter table senders enable row level security;
alter table reply_addresses enable row level security;
alter table clusters enable row level security;
alter table claims enable row level security;
alter table cluster_counts enable row level security;
alter table verdicts enable row level security;
alter table sources enable row level security;
alter table source_items enable row level security;
alter table alerts enable row level security;
alter table outbound_queue enable row level security;
alter table events enable row level security;
alter table settings enable row level security;

-- senders and reply_addresses: no policies, so only the service role (which bypasses RLS) can touch them.

create policy journalists_read on journalists for select to authenticated using (is_journalist());
create policy journalists_update_self on journalists for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy invites_read on journalist_invites for select to authenticated using (is_journalist());
create policy invites_insert on journalist_invites for insert to authenticated with check (is_journalist());
create policy invites_delete on journalist_invites for delete to authenticated using (is_journalist());

create policy clusters_read on clusters for select to authenticated using (is_journalist());
create policy claims_read on claims for select to authenticated using (is_journalist());
create policy counts_read on cluster_counts for select to authenticated using (is_journalist());
create policy verdicts_read on verdicts for select to authenticated using (is_journalist());
create policy verdicts_insert on verdicts for insert to authenticated with check (is_journalist());
create policy sources_read on sources for select to authenticated using (is_journalist());
create policy sources_insert on sources for insert to authenticated with check (is_journalist());
create policy sources_update on sources for update to authenticated using (is_journalist()) with check (is_journalist());
create policy source_items_read on source_items for select to authenticated using (is_journalist());
create policy alerts_read on alerts for select to authenticated using (is_journalist());
create policy outbound_read on outbound_queue for select to authenticated using (is_journalist());
create policy events_read on events for select to authenticated using (is_journalist());
create policy settings_read on settings for select to authenticated using (is_journalist());
create policy settings_write on settings for update to authenticated using (is_journalist()) with check (is_journalist());

-- Realtime for the live dashboard (postgres_changes respects RLS).
do $$
declare t text;
begin
  foreach t in array array['clusters','claims','cluster_counts','verdicts','alerts','events','outbound_queue','sources'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Private bucket for claim images, purged within 24 hours by purge-media-scheduled.
insert into storage.buckets (id, name, public) values ('claim-media', 'claim-media', false)
on conflict (id) do nothing;
