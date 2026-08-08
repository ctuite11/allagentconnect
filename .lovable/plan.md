# "Don't miss opportunities" — one-time agent activation email + Success Hub banner

## Audience (verified)

Verified + activated agents with zero active Hot Sheets: **238 agents** today. The audience is computed at send time from `agent_settings` (verified and activated) minus anyone owning an active Hot Sheet, then run through the existing suppression/unsubscribe union so opted-out addresses are dropped.

One send. Deduped by a fixed idempotency key per recipient, so a re-run cannot double-send. No recurring campaign, no Hot Sheet replay, backfill, or retry of any kind.

## Part 1 — The email

New template `agent-activation-nudge`, built on the existing AAC Unified email template so it matches every other AAC email. Content exactly as written:

- Subject: Don't miss opportunities on All Agent Connect
- Greeting with the agent's first name (falls back to a neutral greeting when missing)
- Section 1 — Hot Sheets: create a Hot Sheet for what you or your buyers are looking for; AAC automatically matches Off Market, Coming Soon, and active listings and alerts you when new opportunities appear. Button: **Create a Hot Sheet** -> Hot Sheets page.
- Section 2 — Communication Center: you control what you hear about; choose areas, property types, and communication types, and turn off the rest; use it for Buyer Needs, Renter Needs, Sales Intel, and agent discussions without irrelevant email. Button: **Open Communication Center** -> Communications page.
- Closing: "Set it once. AAC keeps working for you." / All Agent Connect / By agents. For agents. All agents.
- Standard AAC footer with the existing unsubscribe link. Section headers use text labels, not emoji images, so they render in every client.

## Part 2 — Success Hub banner

The same two-part message appears in-app on the Success Hub dashboard for agents with zero active Hot Sheets: one card, two blocks (Hot Sheets / Communication Center), each with its own button routing to the same destinations. Uses existing AAC section-card styling and brand tokens — no redesign. Dismissible per agent, and it disappears automatically once they create a Hot Sheet.

## Send procedure (staged, with your approval at each gate)

1. Build the template and the audience query; run a **dry run** that returns the recipient count and a sample list. Nothing queued.
2. Send **one test to you only** so you can read it in a real inbox.
3. On your explicit go-ahead, enqueue the real send to the audience. Report queued count, sent count, and any suppressed addresses.

I will not enqueue anything to real recipients without your explicit approval at step 3.

## Safety constraints honored

- Existing email templates are untouched; this adds one new template only.
- Hot Sheet stream and its crons are not modified. Nothing is re-enqueued, retried, or backfilled.
- No changes to `hot_sheet_sent_listings`, existing `email_jobs`, or matcher/delivery code.
- Suppression and unsubscribe checks are mandatory, not bypassable.

## Technical notes

- New shared builder `supabase/functions/_shared/buildAgentActivationNudgeEmailHtml.ts`, modeled on `buildCommsCenterGuideEmailHtml.ts`.
- New function `supabase/functions/send-agent-activation-nudge/index.ts`, modeled on `send-comms-guide-email`, supporting `{ dryRun: true }`, `{ to: [...] }` for the single test, and the audience send.
- Template `agent-activation-nudge` must be added to `public.email_stream_for_template` as stream `communications` (unclassified templates are unclaimable and would never send). Migration file, no other schema change.
- Idempotency key: `agent-activation-nudge-<email>` — fixed, no date component, so it can only ever send once per address.
- Frontend: banner component under `src/components/success-hub/`, rendered in `src/pages/success-hub/SuccessHubDashboard.tsx`, gated on an active-Hot-Sheet count of zero; dismissal stored per agent.
- Deploy the new function after creation.
