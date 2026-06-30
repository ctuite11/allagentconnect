## Scope
Only the "personal forward" invite email (the one you forward from your inbox). The agent-forward template used for other agents is unchanged.

## Changes

1. `supabase/functions/send-personal-forward-invite/index.ts`
   - After loading the agent profile, override `agent.title = "Founder"` so the footer reads "Chris Tuite / Founder" regardless of what's stored on the profile.
   - Run the phone through `formatUsPhoneForDisplay` (already exists in `_shared/phoneFormat.ts`) before passing it into the email builder, so it shows as `(XXX) XXX-XXXX`.

2. `supabase/functions/_shared/buildAgentForwardEmailHtml.ts`
   - Add an optional `contactLayout?: "inline" | "stacked"` field to `AgentForwardEmailOptions` (defaults to current inline behavior).
   - When `stacked`, render phone, email, and website as separate `<p>` lines instead of joining with ` · `. Company stays where it is.
   - No change to existing agent-forward callers.

3. `supabase/functions/send-personal-forward-invite/index.ts`
   - Pass `contactLayout: "stacked"` so email lands on its own line under the formatted phone.

## Deploy + verify
- Redeploy `send-personal-forward-invite`.
- Trigger a fresh send to `chris@allagentconnect.com` with a new idempotency key and confirm the rendered footer shows: name, "Founder", company, phone (formatted), email (next line).

## Out of scope
Agent-forward template, License Verified email, founder invite, any other email layout.
