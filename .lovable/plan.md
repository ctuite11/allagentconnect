Make bulk campaign emails (Founding Partner, etc.) send from Chris personally instead of the generic "All Agent Connect &lt;hello@allagentconnect.com&gt;".

## Change

**1. `netlify/functions/email-worker.ts`** (line ~356) — honor a per-job `from` override:

```ts
from: payload.from || `${FROM_NAME} <${FROM_EMAIL}>`,
```

**2. `supabase/functions/send-bulk-email/index.ts`** — set `from` on both enqueue paths (group send ~line 552, individual send ~line 610):

```
from: "Chris Tuite <chris@allagentconnect.com>"
```

`reply_to: agentEmail` stays as-is.

## Scope

- Only `send-bulk-email` (the campaign tool you personally send from).
- All other system emails (auth, hot sheets, transactional notifications, invitations) keep sending from `hello@allagentconnect.com` — unchanged.
- No DNS work needed; `chris@allagentconnect.com` is already on the verified sending domain.

## Deploy

Redeploy `send-bulk-email`. The Netlify email-worker redeploys on push.

## Inbox preview

Recipients will see:

> **Chris Tuite** &lt;chris@allagentconnect.com&gt;