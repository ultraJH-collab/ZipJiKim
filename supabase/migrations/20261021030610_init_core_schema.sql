-- 집지킴 360 P0: 계정 · 매물 · 사용자 상태 · 계약 · 사진 금고 · 봉인 기록

-- 프로필 (auth.users 가입 시 자동 생성)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'tenant' check (role in ('tenant','landlord','agent','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role in ('tenant','landlord'));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(coalesce(new.email, ''), '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 매물 (금액 단위: 만원). 검색용 컬럼 + 나머지 속성은 detail jsonb
create table public.listings (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  addr text not null,
  dong text not null,
  type text not null,
  deal text not null check (deal in ('전세','월세')),
  deposit integer not null check (deposit >= 0),
  rent integer not null default 0 check (rent >= 0),
  rooms text,
  landlord_verified boolean not null default false,
  status text not null default 'public' check (status in ('public','hidden')),
  sort integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_owner_idx on public.listings(owner_id);
alter table public.listings enable row level security;
create policy "listings_select_public" on public.listings for select to anon, authenticated using (status = 'public' or owner_id = (select auth.uid()));
create policy "listings_insert_owner" on public.listings for insert to authenticated with check (owner_id = (select auth.uid()) and landlord_verified = false);
create policy "listings_update_owner" on public.listings for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and landlord_verified = false);

-- 찜
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites(listing_id);
alter table public.favorites enable row level security;
create policy "favorites_own" on public.favorites for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 사용자 상태 (정밀 리포트 열람, 무료 사용 여부, 안심케어 구독)
create table public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlocked text[] not null default '{}',
  free_used boolean not null default false,
  care boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy "user_state_own" on public.user_state for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 진행 중 계약 (P0: 사용자당 1건, 위저드 상태 그대로 jsonb 보관 — P1에서 당사자 테이블로 분리)
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  listing_id text not null references public.listings(id),
  step integer not null default 0,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index contracts_listing_idx on public.contracts(listing_id);
alter table public.contracts enable row level security;
create policy "contracts_own" on public.contracts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 사진 금고 메타 (거주기간·판정·시공비·청구액)
create table public.vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.vaults enable row level security;
create policy "vaults_own" on public.vaults for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 사진 금고 사진 (원본은 Storage vault-photos/{uid}/{phase}/{slot})
create table public.vault_photos (
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null check (phase in ('in','out')),
  slot text not null,
  storage_path text,
  client_sha256 text not null check (client_sha256 ~ '^[0-9a-f]{64}$'),
  size integer,
  taken_at timestamptz,
  server_received_at timestamptz not null default now(),
  primary key (user_id, phase, slot)
);
alter table public.vault_photos enable row level security;
create policy "vault_photos_own" on public.vault_photos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 서버 수신 시각이 클라이언트 값으로 위조되지 않도록 강제
create function public.force_server_time() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_received_at := now();
  return new;
end $$;
create trigger vault_photos_server_time before insert or update on public.vault_photos for each row execute function public.force_server_time();

-- 봉인 기록 (append-only): 계약서 해시 · 금고 머클 루트 + 서버 시각
create table public.seals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('contract','vault')),
  ref text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  server_time timestamptz not null default now()
);
create index seals_user_idx on public.seals(user_id, kind, ref);
alter table public.seals enable row level security;
create policy "seals_select_own" on public.seals for select to authenticated using (user_id = (select auth.uid()));
create policy "seals_insert_own" on public.seals for insert to authenticated with check (user_id = (select auth.uid()));
-- UPDATE/DELETE 정책 없음 → RLS로 거부. service_role 우회도 트리거로 차단
create function public.seals_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.server_time := now();
    return new;
  end if;
  raise exception 'seals is append-only';
end $$;
create trigger seals_guard before insert or update or delete on public.seals for each row execute function public.seals_immutable();

-- updated_at 자동 갱신
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger listings_touch before update on public.listings for each row execute function public.touch_updated_at();
create trigger user_state_touch before update on public.user_state for each row execute function public.touch_updated_at();
create trigger contracts_touch before update on public.contracts for each row execute function public.touch_updated_at();
create trigger vaults_touch before update on public.vaults for each row execute function public.touch_updated_at();

-- 실시간 동기화 (기기 간)
alter publication supabase_realtime add table public.contracts, public.vaults, public.vault_photos;

-- Storage: 비공개 사진 버킷, 경로 첫 세그먼트 = 본인 uid
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault-photos', 'vault-photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif']);
create policy "vault_photos_obj_select" on storage.objects for select to authenticated using (bucket_id = 'vault-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "vault_photos_obj_insert" on storage.objects for insert to authenticated with check (bucket_id = 'vault-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "vault_photos_obj_update" on storage.objects for update to authenticated using (bucket_id = 'vault-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "vault_photos_obj_delete" on storage.objects for delete to authenticated using (bucket_id = 'vault-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
