## Goal

When an agent edits the Email field in their Profile (Agent Profile Editor), that address becomes the address used for **all outbound app email sending (From/Reply-To name+address resolution)** and **all inbound/recipient routing** (listing inquiries, contact agent, buyer→agent messages, alerts, hot sheet notifications, etc.).

Login/auth email is **out of scope** — Supabase Auth credential stays on the original address you signed up with.

## Current state (audit summary)

- **Profile editor** writes only to `agent_profiles.email` (single row update at `AgentProfileEditor.tsx` line 265).
- **Sender resolver** (`src/lib/currentSenderProfile.ts` → `senderFromAgentProfiles`) already reads `agent_profiles.email` first, falling back to auth email. ✅ Already correct.
- **Recipient resolvers** across edge functions are inconsistent:
  - ✅ `send-client-agent-message`, `send-buyer-agent-email`, `send-agent-client-email`, `notify-agents`, `notify-matching-buyers`, `send-seller-alert` → query `agent_profiles.email` first.
  - ⚠️ Several fall back to `public.profiles.email` if `agent_profiles.email` is blank — but the editor never updates `profiles.email`, so when an agent has a row in both tables with different emails, the fallback can leak the stale `profiles.email`.
  - ⚠️ A few resolve through `auth.users.email` as a last resort.
- **Listings table** does NOT snapshot agent email (looked up live via `agent_id` → `agent_profiles.email`). ✅
- **`profiles.email`** for an agent user is not kept in sync when the agent updates their Profile email, so any code path that reads `profiles.email` for the same `user_id` returns the stale value.

The Chris Tuite issue we just fixed was branding on the `from` line. This task is the data-source issue underneath it.

## Plan

### 1. Single write target → sync both tables on save

In `AgentProfileEditor.tsx` `saveProfileData()`:
- Keep the existing `agent_profiles.update({ email, ... })`.
- Add a parallel `profiles.upsert({ id: session.user.id, email }, { onConflict: 'id' })` (only the email + first/last name fields, to avoid blowing away buyer-only columns).
- This ensures every legacy fallback path (`profiles.email`) returns the same address.

### 2. Recipient resolution order — standardize

For every edge function that resolves an agent's email by `agent_id`, enforce the order:
1. `agent_profiles.email` (live, user-editable)
2. `profiles.email` (now kept in sync by step 1)
3. `auth.users.email` (legacy fallback only)

Files to align (one small helper or inline tweak each):
- `supabase/functions/send-buyer-agent-email/index.ts`
- `supabase/functions/send-agent-client-email/index.ts`
- `supabase/functions/send-client-agent-message/index.ts`
- `supabase/functions/send-seller-alert/index.ts`
- `supabase/functions/send-listing-share/index.ts` (verify — currently no agent_profiles reference)
- `supabase/functions/send-agent-profile-contact/index.ts` (verify recipient lookup uses agent_profiles.email)

No change needed for `notify-agents` / `notify-matching-buyers` (already correct).

### 3. Sender (`From` name + `Reply-To`) — already correct

`getCurrentSenderProfile` already prefers `agent_profiles.email`. No code change. After step 1, the auth-email fallback inside `buildSenderProfile` becomes effectively unused for agents who've saved a profile email.

### 4. Validation / UX in Profile editor

- Validate email format before save (basic regex).
- On successful save show a confirmation toast: "Email updated — outbound and inbound app emails now use {new email}."
- Add a small helper text under the Email field: "Used as the From/Reply-To and recipient for all app emails. Your sign-in email stays the same."

### 5. Out of scope (explicit)

- **Auth/login email** (`auth.users.email`) is NOT changed. The Supabase Auth credential remains the original signup email.
- Existing queued/sent `email_jobs` are NOT rewritten — change applies to new sends only.
- No DB schema migration is needed.

## Files touched

- `src/pages/AgentProfileEditor.tsx` (write to `profiles` too, validation, helper text)
- `supabase/functions/send-buyer-agent-email/index.ts` (resolver order)
- `supabase/functions/send-agent-client-email/index.ts` (resolver order)
- `supabase/functions/send-client-agent-message/index.ts` (resolver order)
- `supabase/functions/send-seller-alert/index.ts` (resolver order)
- `supabase/functions/send-agent-profile-contact/index.ts` (verify + align)
- `supabase/functions/send-listing-share/index.ts` (verify + align)

## Verification

1. Update Profile email to a test address → save.
2. Confirm `agent_profiles.email` and `profiles.email` both show the new address (one read query).
3. Trigger: a buyer sends a contact from a listing → recipient = new address; From = "All Agent Connect <hello@mail.allagentconnect.com>"; Reply-To routes back to whoever contacted.
4. Trigger: agent sends a message via Comms Center → From identity uses the new address as Reply-To.
5. Sign-out / sign-in still works using the original auth email.