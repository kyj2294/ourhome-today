-- 우리집 오늘 — Supabase 설정 (이미 적용됨: 프로젝트 mbwesjfgtxcqyfrtpyzt)
-- 새 프로젝트에 다시 만들 때 SQL Editor에서 순서대로 실행한다.

-- 1) 가족 문서 + 로그인 계정 연결
create table public.oh_families (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.oh_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id text not null references public.oh_families(id) on delete cascade,
  member_id text not null
);
create index oh_members_family_idx on public.oh_members(family_id);
alter table public.oh_families enable row level security;
alter table public.oh_members enable row level security;

create or replace function public.oh_is_member(fid text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.oh_members m where m.family_id = fid and m.user_id = (select auth.uid()));
$$;
revoke execute on function public.oh_is_member(text) from public, anon;
grant execute on function public.oh_is_member(text) to authenticated;

create policy "oh: members read their family" on public.oh_families for select to authenticated using (public.oh_is_member(id));
create policy "oh: read own membership" on public.oh_members for select to authenticated using (user_id = (select auth.uid()));

-- 저장은 이 함수로만: 버전이 맞을 때만 (null = 다른 기기가 먼저 저장함)
create or replace function public.oh_save_state(p_family text, p_state jsonb, p_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare new_version integer;
begin
  if not public.oh_is_member(p_family) then raise exception 'not a family member'; end if;
  update public.oh_families set state = p_state, version = version + 1, updated_at = now()
   where id = p_family and version = p_version returning version into new_version;
  return new_version;
end;
$$;
revoke execute on function public.oh_save_state(text, jsonb, integer) from public, anon;
grant execute on function public.oh_save_state(text, jsonb, integer) to authenticated;

alter publication supabase_realtime add table public.oh_families;

-- 2) 사진 저장소 (비공개, 가족 폴더별)
insert into storage.buckets (id, name, public) values ('ourhome-photos', 'ourhome-photos', false) on conflict (id) do nothing;
create policy "oh: family reads photos" on storage.objects for select to authenticated
  using (bucket_id = 'ourhome-photos' and public.oh_is_member((storage.foldername(name))[1]));
create policy "oh: family uploads photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'ourhome-photos' and public.oh_is_member((storage.foldername(name))[1]));

insert into public.oh_families (id) values ('ourhome');

-- 3) 예시 계정 4개 (비밀번호 1234) — 프로토타입 전용
do $$
declare acc record; uid uuid;
begin
  for acc in select * from (values ('mom@ourhome.app','m_mom'), ('dad@ourhome.app','m_dad'), ('minsu@ourhome.app','m_minsu'), ('jieun@ourhome.app','m_jieun')) as t(email, member_id)
  loop
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acc.email, extensions.crypt('1234', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('member_id', acc.member_id), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', acc.email, 'email_verified', true), 'email', now(), now(), now());
    insert into public.oh_members (user_id, family_id, member_id) values (uid, 'ourhome', acc.member_id);
  end loop;
end $$;

-- 가족 데이터를 처음(샘플)으로 되돌리기: 다음 로그인 때 샘플 가족이 새로 만들어진다
-- update public.oh_families set state = '{}'::jsonb, version = version + 1 where id = 'ourhome';
