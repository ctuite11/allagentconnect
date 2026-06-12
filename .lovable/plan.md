# Comms Center — Send button + success toast

Two small fixes in `src/components/communication-center/SendEmailDialog.tsx` and one wording fix in the edge function.

## 1. Send button → AAC blue

Currently the primary Send button is styled neutral-900/black:

```
className={`${commsOutlineButton} bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white`}
```

Change to the AAC primary token so it matches the rest of the app:

```
className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm"
```

(`--primary` is already AAC Blue `#0E56F5` per the brand tokens — no hardcoded hex.)

## 2. Success toast wording

Today the toast reads:

```
Email sent to 0 recipients
```

…because the edge function actually returns `{ success, message: "Queued N emails", queued: N }`, and the client reads `data?.sent || data?.recipientCount` which are both undefined. That's why it looks like the "queued" copy is leaking through / the count is wrong.

Replace lines 255–256 with a clean AAC-style success:

```ts
const count = data?.sent ?? data?.queued ?? data?.recipientCount ?? 0;
const copyMsg = sendCopyToSelf ? " A copy was sent to you." : "";
toast.success("Message sent", {
  description: `Delivered to ${count} agent${count === 1 ? "" : "s"}.${copyMsg}`,
});
```

## 3. Edge function response (wording only)

In `supabase/functions/send-client-need-notification/index.ts`, change the final success payload so any future readers don't see "Queued…":

```ts
return new Response(
  JSON.stringify({
    success: true,
    message: `Message sent to ${agentProfiles.length} agents`,
    sent: agentProfiles.length,
  }),
  ...
);
```

No other behavior, queries, or layouts change. Out of scope: SendEmail dialog layout, Network Activity feed, channel cards.
