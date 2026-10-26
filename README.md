# School Staff Biometric Attendance

Mobile-first attendance management for two assigned portals only: **School Admin** and **Portal Admin**. The app uses Next.js 14 App Router, Tailwind CSS, Supabase Auth, Prisma, and Supabase Postgres.

## Local setup

1. Install Node.js 18.17 or later and run `npm install`.
2. Create a Supabase project and apply the SQL migrations in [`supabase/migrations`](./supabase/migrations) in filename order using the Supabase SQL editor or CLI.
3. Copy `.env.example` to `.env.local`. Set the Supabase project URL and publishable (or anon) key, a server-only runtime PostgreSQL URL in `DATABASE_URL`, and an owner/migration URL in `DIRECT_URL`. Prisma connections do not carry the Supabase user JWT and therefore do not rely on RLS. Keep both URLs server-only; use a dedicated runtime database role with `BYPASSRLS` and only the table privileges this app needs, and reserve the owner URL for migrations.
4. Run `npm run db:migrate` to apply the Prisma role migration, then `npm run db:generate` to generate the Prisma client.
5. Create user accounts in Supabase Auth. There is no public sign-up.
6. As a trusted project owner, assign each account a role and school in `public.user_roles`. This is the canonical source for application roles; the Prisma migration keeps the legacy profile role synchronized and clears it when an assignment is removed. An account without a row in `user_roles` is intentionally denied access. A School Admin must be assigned a school; a Portal Admin must have `school_id = null`. For example:

   ```sql
   insert into public.schools (name) values ('Yeka D.M.K.M Primary & Middle School');

   insert into public.user_roles (user_id, role, school_id)
   values (
     'AUTH_USER_UUID',
     'school_admin',
     (select id from public.schools where name = 'Yeka D.M.K.M Primary & Middle School')
   );

   -- For a platform administrator:
   insert into public.user_roles (user_id, role, school_id)
   values ('AUTH_USER_UUID', 'portal_admin', null);
   ```

   Do not expose Supabase service-role keys in this app or browser. Account provisioning and school/role assignment should only be performed by trusted operators.

7. Start the application with `npm run dev`; verify with `npm run typecheck` and `npm run build`.

## Included functionality

- School Admin: staff registration, weekly Monday–Friday register, daily totals, manual attendance status updates, CSV export, print-ready A4 report and touch-friendly scanner simulator.
- Portal Admin: school and staff totals, scanner device health, recent hardware logs and platform status.
- Ethiopian calendar labels and Ethiopian clock conversion use the native `Intl.DateTimeFormat` API and Africa/Addis_Ababa time.
- Supabase Auth provides identity and session cookies. Server-side application data access uses Prisma with the `DATABASE_URL` connection; authorization is checked against the canonical `user_roles` record on each request. API responses are school-scoped; portal-wide APIs require the Portal Admin role.

## Biometric hardware note

The included scanner dialog is explicitly a UI simulator: it only sets `signature_verified` for a test attendance record and does not capture, transmit, or store a fingerprint. Real biometric enrollment and device health reporting require an approved vendor/device integration and a trusted device-side service. Keep raw biometric templates on certified hardware; do not place raw biometric data in browser storage or send it to these web endpoints.

## Next.js security status

This project is pinned to the requested Next.js 14 line (`14.2.35`). The current dependency audit reports a critical advisory affecting this version, and npm does not offer a fixed Next.js 14 release. Do not deploy this version to an internet-facing production environment until the framework is upgraded to a patched major release or an authorized security exception is accepted. The PostCSS-related advisories are addressed with compatible dependency overrides.

## Database and calendar formats

`attendance_records.date` stores a zero-padded Ethiopian calendar key (`YYYY-MM-DD`), and the unique staff/date constraint makes retries idempotent. `day_of_week` stores one of the five Amharic weekday names. The scanner and platform health tables are provisioned by the migration; hardware agents should report via a separately authenticated service endpoint using a server-only credential.
