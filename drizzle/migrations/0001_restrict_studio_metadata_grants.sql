REVOKE ALL ON public.studio_usage FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.studio_usage FROM authenticated;
REVOKE ALL ON public.studio_ai_access FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.studio_ai_access FROM authenticated;