## CTA verification — Comms Center Guide email

**Result: CTA is correctly wired. No code change needed.**

Confirmed against the deployed source:

1. `supabase/functions/send-comms-guide-email/index.ts:41` builds the CTA via `resolveAacCtaUrl(body.ctaUrl, "/communications")`.
2. `resolveAacCtaUrl` (in `supabase/functions/_shared/aacPublicUrl.ts`) returns `${AAC_PUBLIC_URL}${path}` when no override is passed — i.e. `https://allagentconnect.com/communications`.
3. The admin preview and BulkEmailDialog callers do not pass a `ctaUrl`, so the fallback is what ships in every send.
4. `src/App.tsx:392` registers `/communications` → `ClientNeedsDashboard` behind `RouteGuard requireRole="agent"`. The legacy `/communication-center` also redirects here (line 466).
5. The edge function was redeployed after the last CTA fix, so live sends already use `/communications`.

**Behavior for recipients:**
- Verified/activated agent, logged in → lands on the Communications Center (Preferences).
- Not logged in → RouteGuard sends them through the login flow, then back to `/communications`.
- Non-agent role → RouteGuard blocks (expected; recipients are all verified agents).

**Optional live check (only if you want extra proof):**
- Send yourself a fresh preview from Admin Approvals, open the email source, and confirm the CTA `href` is exactly `https://allagentconnect.com/communications` (may be wrapped by the click tracker `.../functions/v1/track-click?...&url=...` — that's normal and resolves to the same destination).

Nothing to implement unless the live check surfaces a mismatch.