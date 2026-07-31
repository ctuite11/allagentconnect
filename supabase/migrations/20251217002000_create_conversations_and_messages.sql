-- Historical schema-only repair for fresh local migration rebuilds.
--
-- Background: public.conversations / public.conversation_messages existed in
-- hosted schema (and schema_snapshot.sql) but never had a CREATE TABLE
-- migration. Fresh supabase start/db reset therefore fails at
-- 20251217003255 when policies target these relations.
--
-- client_needs creation path (for buyer_need_id FK):
--   20251027231318 creates public.buyer_needs
--   20251108061222 renames buyer_needs -> client_needs
--
-- Safety for hosted DBs that already have these tables but have not recorded
-- this out-of-order version:
--   * When a table already exists: read-only compatibility assertions only.
--     No column/constraint/index writes. Fail clearly if incompatible.
--   * When absent: create the complete authoritative base shape from
--     docs/database/schema_snapshot.sql (no rows, policies, triggers, or
--     publication entries — later migrations own those).
--
-- Eventual out-of-order application on staging must be tested before any
-- production apply. Do not db push / --include-all / link from this workstream.

DO $$
DECLARE
  missing text;
BEGIN
  --------------------------------------------------------------------------
  -- public.conversations
  --------------------------------------------------------------------------
  IF to_regclass('public.conversations') IS NULL THEN
    IF to_regclass('public.client_needs') IS NULL THEN
      RAISE EXCEPTION
        'Migration history defect: public.client_needs is required to create public.conversations (buyer_need_id FK) but to_regclass(''public.client_needs'') is NULL. Expected buyer_needs@20251027231318 then rename@20251108061222.';
    END IF;
    IF to_regclass('public.listings') IS NULL THEN
      RAISE EXCEPTION
        'Migration history defect: public.listings is required to create public.conversations (listing_id FK) but to_regclass(''public.listings'') is NULL.';
    END IF;

    CREATE TABLE public.conversations (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      agent_a_id uuid NOT NULL,
      agent_b_id uuid NOT NULL,
      listing_id uuid,
      buyer_need_id uuid,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      last_message_at timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT conversations_pkey PRIMARY KEY (id),
      CONSTRAINT unique_conversation UNIQUE (agent_a_id, agent_b_id, listing_id, buyer_need_id),
      CONSTRAINT conversations_buyer_need_id_fkey
        FOREIGN KEY (buyer_need_id) REFERENCES public.client_needs(id) ON DELETE SET NULL,
      CONSTRAINT conversations_listing_id_fkey
        FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_conversations_agent_a ON public.conversations USING btree (agent_a_id);
    CREATE INDEX idx_conversations_agent_b ON public.conversations USING btree (agent_b_id);
    CREATE INDEX idx_conversations_last_message_at ON public.conversations USING btree (last_message_at DESC);
    CREATE INDEX idx_conversations_updated_at ON public.conversations USING btree (updated_at DESC);

    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
  ELSE
    -- Existing hosted table: no schema writes. Assert columns required by
    -- subsequent migrations (starting with 20251217003255).
    missing := NULL;
    SELECT string_agg(req.col, ', ' ORDER BY req.col)
      INTO missing
    FROM (VALUES
      ('id'),
      ('agent_a_id'),
      ('agent_b_id'),
      ('listing_id'),
      ('buyer_need_id'),
      ('created_at'),
      ('updated_at')
    ) AS req(col)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'conversations'
        AND c.column_name = req.col
    );

    IF missing IS NOT NULL THEN
      RAISE EXCEPTION
        'Existing public.conversations is incompatible with historical repair expectations. Missing columns: %. Refusing to alter hosted schema from this migration.',
        missing;
    END IF;
  END IF;

  --------------------------------------------------------------------------
  -- public.conversation_messages
  --------------------------------------------------------------------------
  IF to_regclass('public.conversation_messages') IS NULL THEN
    IF to_regclass('public.conversations') IS NULL THEN
      RAISE EXCEPTION
        'Migration history defect: public.conversations is required to create public.conversation_messages but is absent.';
    END IF;

    CREATE TABLE public.conversation_messages (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      conversation_id uuid NOT NULL,
      sender_agent_id uuid NOT NULL,
      recipient_agent_id uuid NOT NULL,
      subject text,
      body text NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      read_at timestamp with time zone,
      CONSTRAINT conversation_messages_pkey PRIMARY KEY (id),
      CONSTRAINT conversation_messages_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_conversation_messages_conversation
      ON public.conversation_messages USING btree (conversation_id);
    CREATE INDEX idx_conversation_messages_recipient_read
      ON public.conversation_messages USING btree (recipient_agent_id, read_at);

    ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
  ELSE
    missing := NULL;
    SELECT string_agg(req.col, ', ' ORDER BY req.col)
      INTO missing
    FROM (VALUES
      ('id'),
      ('conversation_id'),
      ('sender_agent_id'),
      ('recipient_agent_id'),
      ('subject'),
      ('body'),
      ('created_at'),
      ('read_at')
    ) AS req(col)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'conversation_messages'
        AND c.column_name = req.col
    );

    IF missing IS NOT NULL THEN
      RAISE EXCEPTION
        'Existing public.conversation_messages is incompatible with historical repair expectations. Missing columns: %. Refusing to alter hosted schema from this migration.',
        missing;
    END IF;
  END IF;
END $$;
