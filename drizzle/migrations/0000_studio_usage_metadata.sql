CREATE TABLE public.studio_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 tool text NOT NULL CHECK (tool IN ('voice-over','dubbing','podcast','coach')),
 language text NOT NULL,
 character_count integer NOT NULL CHECK (character_count >= 0),
 generation_kind text NOT NULL DEFAULT 'production' CHECK (generation_kind IN ('production','script'))
);
GRANT SELECT ON public.studio_usage TO authenticated;
GRANT ALL ON public.studio_usage TO service_role;
ALTER TABLE public.studio_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read Studio usage" ON public.studio_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX studio_usage_user_date ON public.studio_usage (user_id, created_at DESC);
CREATE TABLE public.studio_ai_access (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 denial_message text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_ai_access TO authenticated;
GRANT ALL ON public.studio_ai_access TO service_role;
ALTER TABLE public.studio_ai_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read Studio AI access" ON public.studio_ai_access FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));