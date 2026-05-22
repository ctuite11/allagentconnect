## Goal

Connect the **New Buyer** dialog to the agent's CRM **Contacts** so the agent can:
1. **Pick** an existing contact and have name/email/phone pre-filled, then convert them into a buyer (their `client_type` flips to `buyer`).
2. If the typed email is **not** in Contacts, see a small inline option to **also add this person to Contacts as a buyer** before sending the invite.

## UX changes (CreateBuyerDialog.tsx)

```text
┌─ New Buyer ────────────────────────────────────┐
│  [ Search existing contact… ▼ ]  ← new combobox │
│  ────────── or enter new ──────────             │
│  First name      Last name                      │
│  Email                                          │
│  Phone (optional)                               │
│                                                 │
│  ☑ Also add to Contacts as a buyer              │
│     (only shown when email is NOT in contacts)  │
│                                                 │
│            [Cancel]  [Create Buyer]             │
└─────────────────────────────────────────────────┘
```

### Behavior

- **Contact picker (top)**: Command/Combobox listing the agent's `clients` rows (any `client_type`). Selecting one:
  - Pre-fills first/last/email/phone (read-only chip-style indicator "From Contacts").
  - On submit, reuses that `clients.id`. If `client_type !== 'buyer'`, update it to `'buyer'`. Then create the `client_agent_relationships` row exactly as today.
  - Hides the "Also add to Contacts" checkbox (already a contact).

- **Manual entry**:
  - As the agent types email, debounce-check against this agent's `clients` by email (case-insensitive).
  - If a match exists → auto-switch to "from contacts" mode (same as picking).
  - If no match → show the **"Also add to Contacts as a buyer"** checkbox, **default ON**.
    - ON → current insert path (already inserts into `clients` with `client_type='buyer'`).
    - OFF → skip the `clients` insert and only create the relationship via a CRM-less path. **Note:** today the schema requires `crm_client_id` on the relationship, so OFF is not viable without schema work. Recommend keeping the checkbox **always-on and disabled with helper text** ("New buyers are saved to Contacts") OR removing the checkbox and just showing an inline note. See "Decision needed" below.

## Data rules

- Existing contact selected:
  - `UPDATE clients SET client_type='buyer' WHERE id=<picked> AND agent_id=me` (only if not already buyer).
  - Backfill missing phone/first/last from form values (don't overwrite existing non-null fields).
  - Then `INSERT INTO client_agent_relationships (agent_id, crm_client_id, status='pending', client_id=null)` — same as current "no existing relationship" branch.
  - Reuse existing `agent_reactivate_buyer` RPC if a prior ended relationship exists.

- New contact (not in CRM):
  - Same insert as today (`clients` row with `client_type='buyer'`) + relationship row.

## Decision needed

The current schema/flow always creates a `clients` row for a new buyer (so they're already in Contacts). The user said: *"if the buyer is not in contacts then need option before invite to add to contacts as a buyer."* This implies they think buyers can exist without a contact row — but today they can't.

Two ways to honor the intent:

- **Option A (recommended, no schema change):** Always add to Contacts; surface a clear inline note "This buyer will also be saved to your Contacts." Add the **picker** on top so the agent can choose an existing contact instead of duplicating.
- **Option B:** Allow buyer relationships without a `clients` row. Requires schema work (nullable `crm_client_id`, new RLS, audit of all consumers of `My Buyers`). Larger scope.

I'll proceed with **Option A** unless you tell me to do B.

## Files to change

- `src/components/CreateBuyerDialog.tsx` — add contact picker (Command + Popover), pre-fill logic, email lookup, status-flip update, helper text.
- (No new files, no schema migration, no edge function changes.)

## Out of scope

- Bulk convert from Contacts page.
- Changing the invite email content.
- Schema changes to relax `crm_client_id`.
