## Change

In `supabase/functions/_shared/buildCommsCenterGuideEmailHtml.ts` line 56, update the channel-toggle copy to reflect the current UI (simple On/Off switches, no "mute"):

- From: "Mute a channel and you stop receiving those alerts entirely."
- To: "Turn a channel off and you stop receiving those alerts entirely."

## Deploy

Redeploy only `send-comms-guide-email` so the shared template picks up the new copy. Send a fresh preview to confirm.

No other files, templates, styling, or routes change.