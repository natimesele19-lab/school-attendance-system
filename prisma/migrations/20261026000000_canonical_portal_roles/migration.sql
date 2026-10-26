CREATE TYPE public.portal_role AS ENUM ('school_admin', 'portal_admin');

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  DROP CONSTRAINT IF EXISTS user_role_school_assignment;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.portal_role
  USING role::text::public.portal_role;

ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.portal_role
  USING role::text::public.portal_role;

ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role DROP NOT NULL;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_role_school_assignment CHECK (
    (role = 'school_admin' AND school_id IS NOT NULL)
    OR (role = 'portal_admin' AND school_id IS NULL)
  );

UPDATE public.profiles AS profile
SET role = assignment.role
FROM public.user_roles AS assignment
WHERE assignment.user_id = profile.id;

UPDATE public.profiles AS profile
SET role = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles AS assignment
  WHERE assignment.user_id = profile.id
);

CREATE OR REPLACE FUNCTION public.sync_profile_role_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET role = NULL
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  UPDATE public.profiles
  SET role = NEW.role
  WHERE id = NEW.user_id
    AND role IS DISTINCT FROM NEW.role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_sync_profile_role ON public.user_roles;

CREATE TRIGGER user_roles_sync_profile_role
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_from_assignment();
