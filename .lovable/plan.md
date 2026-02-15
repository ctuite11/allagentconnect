

# Refactor Hot Sheet Creation: Defer Invites to "Send First Batch"

## Overview
Currently, invite emails and share tokens are generated in **two places**: during hot sheet creation (CreateHotSheetDialog, lines 885-956) AND during Send First Batch (HotSheetReview, lines 259-327). This causes duplicate tokens/emails and violates the intended flow where invites should only go out when the agent curates and sends listings.

This plan removes the invite logic from creation and ensures it only fires on Send First Batch -- plus fixes the review page to handle **all** clients (not just the first one).

---

## Changes

### 1. CreateHotSheetDialog.tsx -- Remove invite logic from creation

**Delete lines 885-956** (the fire-and-forget invite block inside the create branch). Replace with nothing -- the block that inserts `hot_sheet_clients` (lines 873-883) stays intact.

After deletion, the create flow becomes:
1. Insert `hot_sheets` row
2. Insert `hot_sheet_clients` rows
3. Show success toast
4. Show "Add another contact?" modal
5. Navigate to review page

No tokens. No emails. Clean.

### 2. HotSheetReview.tsx -- Send First Batch handles ALL clients

The current `handleSendFirstBatch` (lines 237-337) only processes the **first** client from `hot_sheet_clients` (note `limit(1)` on line 264). Rewrite to loop over all clients:

**Replace lines 259-328 with:**

```typescript
// Generate share tokens + send invites for ALL clients on this hot sheet
const { data: hscRows, error: hscError } = await supabase
  .from("hot_sheet_clients")
  .select("client_id")
  .eq("hot_sheet_id", hotSheet.id);

if (!hscError && hscRows && hscRows.length > 0) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: agentProfile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const agentName = agentProfile
      ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim()
      : "Your agent";

    for (const row of hscRows) {
      const clientId = row.client_id;

      // Skip if active relationship already exists
      const { data: existingRel } = await supabase
        .from("client_agent_relationships")
        .select("id")
        .eq("agent_id", user.id)
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (existingRel) {
        console.log(`[send-first-batch] Skipping client ${clientId} -- active relationship`);
        continue;
      }

      // Skip if token already exists for this client+hotsheet
      const { data: existingToken } = await supabase
        .from("share_tokens")
        .select("token")
        .eq("agent_id", user.id)
        .contains("payload", {
          type: "client_hotsheet_invite",
          client_id: clientId,
          hot_sheet_id: hotSheet.id,
        })
        .maybeSingle();

      if (existingToken) {
        console.log(`[send-first-batch] Token already exists for client ${clientId}`);
        continue;
      }

      // Look up client email
      const { data: clientData } = await supabase
        .from("clients")
        .select("email")
        .eq("id", clientId)
        .maybeSingle();

      if (!clientData?.email) continue;

      const token = crypto.randomUUID();

      const { error: tokenError } = await supabase
        .from("share_tokens")
        .insert({
          token,
          agent_id: user.id,
          payload: {
            type: "client_hotsheet_invite",
            client_id: clientId,
            hot_sheet_id: hotSheet.id,
            client_email: clientData.email,
          },
        });

      if (tokenError) {
        console.error(`[send-first-batch] Token error for ${clientId}:`, tokenError);
        continue;
      }

      // Send invite email
      const hotSheetLink = `${window.location.origin}/client-invite?invitation_token=${token}&email=${encodeURIComponent(clientData.email)}&agent_id=${user.id}&client_id=${clientId}`;

      supabase.functions.invoke("send-hot-sheet-invite", {
        body: {
          invitedEmail: clientData.email,
          inviterName: agentName,
          hotSheetName: hotSheet.name,
          hotSheetLink,
        },
      }).then(({ error: emailErr }) => {
        if (emailErr) console.error(`[send-first-batch] Email error:`, emailErr);
        else console.log(`[send-first-batch] Invite sent to ${clientData.email}`);
      });
    }
  }
}
```

Key improvements over current code:
- Removes `limit(1)` -- processes ALL clients
- Adds idempotency check (skip if token already exists)
- Adds active-relationship skip (same logic that was in the create dialog)
- Loops per-client with individual error handling

### 3. HotSheetReview.tsx -- Remove BulkShareListingsDialog

Remove the `<BulkShareListingsDialog>` component (lines 504-508) from the controls section per the spec ("Remove Share button"). Also remove its import (line 17).

---

## What stays the same
- `wrapHtml()` premium email templates -- untouched
- `hot-sheet-comment` and `hot-sheet-agent-reply` notification triggers -- untouched
- Client typeahead, "Add Manually", "Add Another Contact" UI in CreateHotSheetDialog -- untouched (already works as described in the spec)
- The `clientInfoOpen` collapsible state defaults to `true` (line 163) -- already always open

---

## Verification Plan

### A) Create hot sheet (no invites)
1. Create a hot sheet with 2 clients
2. Verify `hot_sheets` and `hot_sheet_clients` rows exist
3. Verify **zero** `share_tokens` or `email_jobs` created during creation

### B) Send First Batch (invites fire)
1. Navigate to review page
2. Select listings, click Send First Batch
3. Verify `share_tokens` created for each client
4. Verify `email_jobs` enqueued with correct template and token-based URLs

### C) Idempotency
1. Click Send First Batch again (if button still shows)
2. Verify no duplicate tokens created

### D) Debounce (existing)
Already verified in prior tests -- no changes needed

---

## Files Modified
| File | Change |
|------|--------|
| `src/components/CreateHotSheetDialog.tsx` | Delete lines 885-956 (invite logic) |
| `src/pages/HotSheetReview.tsx` | Rewrite `handleSendFirstBatch` to loop all clients with idempotency; remove `BulkShareListingsDialog` import and usage |

