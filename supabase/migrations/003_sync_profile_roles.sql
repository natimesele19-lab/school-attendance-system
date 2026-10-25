insert into public.profiles (id, email, role)
select u.id, u.email, coalesce(r.role, 'school_admin')
from auth.users u
left join public.user_roles r on r.user_id = u.id
where u.email is not null
on conflict (id) do update
set email = excluded.email,
    role = excluded.role;

create or replace function public.sync_profile_role_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = new.role
  where id = new.user_id
    and role is distinct from new.role;
  return new;
end;
$$;

create trigger user_roles_sync_profile_role
  after insert or update on public.user_roles
  for each row execute function public.sync_profile_role_from_assignment();
