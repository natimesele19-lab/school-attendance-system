create extension if not exists pgcrypto;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 180),
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('school_admin', 'portal_admin')),
  school_id uuid references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_role_school_assignment check (
    (role = 'school_admin' and school_id is not null)
    or (role = 'portal_admin' and school_id is null)
  )
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  gender text not null check (gender in ('ወ', 'ሴ')),
  job_title text not null check (length(trim(job_title)) between 1 and 120),
  biometric_template_hash text,
  created_at timestamptz not null default now()
);
create index staff_school_name_idx on public.staff (school_id, full_name);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  day_of_week text not null check (day_of_week in ('ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ')),
  check_in_time time,
  status text not null check (status in ('Present', 'Late', 'Absent')),
  signature_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, date)
);
create index attendance_records_staff_date_idx on public.attendance_records (staff_id, date);

create table public.biometric_devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  device_name text not null check (length(trim(device_name)) between 1 and 120),
  status text not null default 'offline' check (status in ('online', 'offline', 'maintenance')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.scanner_health_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.biometric_devices(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  message text not null check (length(trim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index scanner_health_logs_created_idx on public.scanner_health_logs (created_at desc);

create table public.system_status (
  component text primary key check (length(trim(component)) between 1 and 100),
  status text not null check (status in ('operational', 'degraded', 'outage', 'maintenance')),
  details text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'portal_admin'
  );
$$;

create or replace function public.has_school_access(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_portal_admin() or exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = 'school_admin'
      and school_id = target_school_id
  );
$$;

revoke all on function public.is_portal_admin() from public;
revoke all on function public.has_school_access(uuid) from public;
grant execute on function public.is_portal_admin() to authenticated;
grant execute on function public.has_school_access(uuid) to authenticated;

alter table public.schools enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff enable row level security;
alter table public.attendance_records enable row level security;
alter table public.biometric_devices enable row level security;
alter table public.scanner_health_logs enable row level security;
alter table public.system_status enable row level security;

create policy "Users can read their own portal assignment"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Portal admins can manage portal assignments"
  on public.user_roles for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create policy "School members can read their school"
  on public.schools for select to authenticated
  using (public.has_school_access(id));
create policy "Portal admins can manage schools"
  on public.schools for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create policy "School admins can read their staff"
  on public.staff for select to authenticated
  using (public.has_school_access(school_id));
create policy "School admins can add staff to their school"
  on public.staff for insert to authenticated
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid())
        and role = 'school_admin'
        and school_id = staff.school_id
    )
  );
create policy "Portal admins can manage staff"
  on public.staff for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create policy "School members can read their attendance"
  on public.attendance_records for select to authenticated
  using (
    exists (select 1 from public.staff s where s.id = staff_id and public.has_school_access(s.school_id))
  );
create policy "School admins can write their attendance"
  on public.attendance_records for insert to authenticated
  with check (
    exists (
      select 1 from public.staff s join public.user_roles r on r.school_id = s.school_id
      where s.id = staff_id and r.user_id = (select auth.uid()) and r.role = 'school_admin'
    )
  );
create policy "School admins can update their attendance"
  on public.attendance_records for update to authenticated
  using (
    exists (
      select 1 from public.staff s join public.user_roles r on r.school_id = s.school_id
      where s.id = staff_id and r.user_id = (select auth.uid()) and r.role = 'school_admin'
    )
  )
  with check (
    exists (
      select 1 from public.staff s join public.user_roles r on r.school_id = s.school_id
      where s.id = staff_id and r.user_id = (select auth.uid()) and r.role = 'school_admin'
    )
  );
create policy "Portal admins can manage attendance"
  on public.attendance_records for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create policy "School admins and portal admins can read devices"
  on public.biometric_devices for select to authenticated
  using (public.has_school_access(school_id));
create policy "Portal admins can manage devices"
  on public.biometric_devices for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create policy "Portal admins can read scanner logs"
  on public.scanner_health_logs for select to authenticated
  using (public.is_portal_admin());
create policy "Portal admins can read platform status"
  on public.system_status for select to authenticated
  using (public.is_portal_admin());

grant select on public.schools, public.user_roles, public.staff, public.attendance_records,
  public.biometric_devices, public.scanner_health_logs, public.system_status to authenticated;
grant insert on public.staff, public.attendance_records to authenticated;
grant update on public.attendance_records to authenticated;
grant all on public.schools, public.user_roles, public.staff, public.attendance_records,
  public.biometric_devices, public.scanner_health_logs, public.system_status to service_role;

create or replace function public.set_attendance_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger attendance_records_updated_at
  before update on public.attendance_records
  for each row execute function public.set_attendance_updated_at();

insert into public.system_status (component, status, details)
values
  ('attendance_api', 'operational', 'Attendance API is accepting requests.'),
  ('database', 'operational', 'Database health status is maintained by operations.')
on conflict (component) do nothing;
