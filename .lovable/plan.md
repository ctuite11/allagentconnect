# Fix — Buyer Needs preview must source from Communications Center

## What's wrong now

`useChannelPreviews.ts` reads `client_needs` for Buyer Needs / Renter Needs, `listings` for Sales Intel, and `agent_messages` for General Discussions. **None of those are the Comms Center.** Comms Center broadcasts (Buyer Need / Sales Intel / Renter Need / General Discussion) are sent by the `send-client-need-notification` edge function, which today only enqueues `email_jobs` rows and **never persists the broadcast itself**. So there is no DB feed for Network Activity to mirror.

## Fix — persist Comms Center broadcasts, then read them

### 1. New table `comms_broadcasts`

Migration `YYYYMMDDHHMM_create_comms_broadcasts.sql`:

```sql
CREATE TABLE public.comms_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('buyer_need','sales_intel','renter_need','general_discussion')),
  subject text NOT NULL,
  message text NOT NULL,
  criteria jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comms_broadcasts_cat_created ON public.comms_broadcasts(category, created_at DESC);

GRANT SELECT, INSERT ON public.comms_broadcasts TO authenticated;
GRANT ALL ON public.comms_broadcasts TO service_role;

ALTER TABLE public.comms_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated agents can read broadcasts"
  ON public.comms_broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Senders insert their own broadcasts"
  ON public.comms_broadcasts FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
```

Read-by-all is intentional — Comms Center broadcasts go to the network.

### 2. Edge function `send-client-need-notification`

After enqueuing `email_jobs`, insert one row into `comms_broadcasts` with `{sender_id: user.id, category, subject, message, criteria, recipient_count: agentProfiles.length}`. Skip on `previewOnly`. No other behavior change.

### 3. Rewrite `useChannelPreviews.ts`

All four hooks query the same source — `comms_broadcasts` filtered by `category`, ordered by `created_at desc`, `limit 3`, joined with `agent_profiles` for the sender. Drop the `client_needs` / `listings` / `agent_messages` queries entirely.

Item shape stays the same (`title` = subject, `subtitle` = message preview, `timestamp`, `agent` = sender contact), so `ChannelPreviewCard` and `NetworkActivitySection` do not change.

## Out of scope

- No changes to `MarketActivityRow` (still the listings feed), `NotificationPreferenceCards`, `SendMessageDialog`, or page ordering — those are already correct.
- No backfill of historical broadcasts (none persisted).
- Communications Center page itself is unchanged.

## Files

- `supabase/migrations/<ts>_create_comms_broadcasts.sql` (new)
- `supabase/functions/send-client-need-notification/index.ts` (edit — insert broadcast row)
- `src/components/success-hub/networkActivity/useChannelPreviews.ts` (rewrite all four hooks against `comms_broadcasts`)
