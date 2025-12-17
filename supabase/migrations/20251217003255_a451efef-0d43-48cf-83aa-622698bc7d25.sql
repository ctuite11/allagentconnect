-- 1) Helper: verified agent check (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_verified_agent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_settings s
    WHERE s.user_id = auth.uid()
      AND s.agent_status = 'verified'
  );
$$;

-- Prevent public from redefining function
REVOKE ALL ON FUNCTION public.is_verified_agent() FROM public;
GRANT EXECUTE ON FUNCTION public.is_verified_agent() TO authenticated;

-- 2) CLIENT_NEEDS: gate INSERT to verified agents only
DROP POLICY IF EXISTS "Agents can insert buyer needs" ON public.client_needs;

CREATE POLICY "Verified agents can insert buyer needs"
ON public.client_needs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_verified_agent()
  AND auth.uid() = submitted_by
);

-- 3) CONVERSATIONS: gate INSERT to verified agents
DROP POLICY IF EXISTS "Agents can create conversations they participate in" ON public.conversations;

CREATE POLICY "Verified agents can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_verified_agent()
  AND (auth.uid() = agent_a_id OR auth.uid() = agent_b_id)
  AND agent_a_id <> agent_b_id
);

-- 4) CONVERSATION_MESSAGES: gate INSERT to verified agents
DROP POLICY IF EXISTS "Agents can send messages in their conversations" ON public.conversation_messages;

CREATE POLICY "Verified agents can send messages in their conversations"
ON public.conversation_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_verified_agent()
  AND auth.uid() = sender_agent_id
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND (
        (c.agent_a_id = sender_agent_id AND c.agent_b_id = recipient_agent_id)
        OR
        (c.agent_b_id = sender_agent_id AND c.agent_a_id = recipient_agent_id)
      )
  )
);

-- 5) LISTINGS: gate INSERT to verified agents
DROP POLICY IF EXISTS "Agents can insert their own listings" ON public.listings;

CREATE POLICY "Verified agents can create listings"
ON public.listings
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_verified_agent()
  AND auth.uid() = agent_id
);

-- 6) LISTINGS: gate UPDATE to verified agents
DROP POLICY IF EXISTS "Agents can update their own listings" ON public.listings;

CREATE POLICY "Verified agents can update their listings"
ON public.listings
FOR UPDATE
TO authenticated
USING (auth.uid() = agent_id)
WITH CHECK (
  public.is_verified_agent()
  AND auth.uid() = agent_id
);