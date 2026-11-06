CREATE TABLE public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL,
  participant_b uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_conversations_distinct_participants CHECK (participant_a < participant_b),
  CONSTRAINT direct_conversations_pair_unique UNIQUE (participant_a, participant_b)
);
GRANT SELECT ON public.direct_conversations TO authenticated;
GRANT ALL ON public.direct_conversations TO service_role;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read direct conversations"
  ON public.direct_conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000)
);
GRANT SELECT ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read direct messages"
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.direct_conversations AS conversation
      WHERE conversation.id = direct_messages.conversation_id
        AND (conversation.participant_a = auth.uid() OR conversation.participant_b = auth.uid())
    )
  );

CREATE INDEX direct_messages_conversation_created_idx
  ON public.direct_messages (conversation_id, created_at);
CREATE INDEX direct_conversations_participant_a_activity_idx
  ON public.direct_conversations (participant_a, last_message_at DESC);
CREATE INDEX direct_conversations_participant_b_activity_idx
  ON public.direct_conversations (participant_b, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.list_direct_conversations()
RETURNS TABLE (
  id uuid,
  other_user_id uuid,
  other_email text,
  other_display_name text,
  last_message text,
  last_message_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT
    conversation.id,
    other_user.id,
    COALESCE(other_user.email, ''),
    profile.display_name,
    latest.body,
    conversation.last_message_at
  FROM public.direct_conversations AS conversation
  JOIN auth.users AS other_user
    ON other_user.id = CASE
      WHEN conversation.participant_a = auth.uid() THEN conversation.participant_b
      ELSE conversation.participant_a
    END
  LEFT JOIN public.profiles AS profile ON profile.id = other_user.id
  LEFT JOIN LATERAL (
    SELECT message.body
    FROM public.direct_messages AS message
    WHERE message.conversation_id = conversation.id
    ORDER BY message.created_at DESC, message.id DESC
    LIMIT 1
  ) AS latest ON true
  WHERE auth.uid() IS NOT NULL
    AND (conversation.participant_a = auth.uid() OR conversation.participant_b = auth.uid())
  ORDER BY conversation.last_message_at DESC, conversation.id;
$function$;
REVOKE ALL ON FUNCTION public.list_direct_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_conversations() TO authenticated;

CREATE OR REPLACE FUNCTION public.send_direct_message(
  _conversation_id uuid,
  _recipient_email text,
  _body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_recipient_id uuid;
  v_participant_a uuid;
  v_participant_b uuid;
  v_conversation_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to send a message';
  END IF;

  IF _body IS NULL OR char_length(btrim(_body)) < 1 OR char_length(btrim(_body)) > 4000 THEN
    RAISE EXCEPTION 'Messages must contain 1 to 4000 characters';
  END IF;

  IF _conversation_id IS NULL THEN
    IF _recipient_email IS NULL
      OR char_length(btrim(_recipient_email)) < 3
      OR char_length(btrim(_recipient_email)) > 320
      OR position('@' IN btrim(_recipient_email)) < 2 THEN
      RAISE EXCEPTION 'Enter a valid email address';
    END IF;

    SELECT user_record.id
      INTO v_recipient_id
      FROM auth.users AS user_record
      WHERE lower(user_record.email) = lower(btrim(_recipient_email))
        AND user_record.id <> v_caller_id
      LIMIT 1;

    IF v_recipient_id IS NULL THEN
      RETURN;
    END IF;

    v_participant_a := LEAST(v_caller_id, v_recipient_id);
    v_participant_b := GREATEST(v_caller_id, v_recipient_id);

    INSERT INTO public.direct_conversations (participant_a, participant_b)
      VALUES (v_participant_a, v_participant_b)
      ON CONFLICT (participant_a, participant_b) DO NOTHING;

    SELECT conversation.id
      INTO v_conversation_id
      FROM public.direct_conversations AS conversation
      WHERE conversation.participant_a = v_participant_a
        AND conversation.participant_b = v_participant_b;
  ELSE
    IF NULLIF(btrim(_recipient_email), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Choose a recipient or an existing conversation';
    END IF;

    SELECT conversation.participant_a, conversation.participant_b
      INTO v_participant_a, v_participant_b
      FROM public.direct_conversations AS conversation
      WHERE conversation.id = _conversation_id
        AND (conversation.participant_a = v_caller_id OR conversation.participant_b = v_caller_id)
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversation not found';
    END IF;

    v_conversation_id := _conversation_id;
  END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, body)
    VALUES (v_conversation_id, v_caller_id, btrim(_body));

  UPDATE public.direct_conversations
    SET last_message_at = now()
    WHERE id = v_conversation_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_conversations, public.direct_messages;