create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'school_admin'
    check (role in ('portal_admin', 'school_admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Portal admins can manage all profiles"
  on public.profiles for all to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
