# Pre-check for duplicate/existing agents in Admin Create Agent

## Goal

When you create a new agent in Admin (Create Agent dialog), warn you **before** the invite is sent if that email is already known to us — already registered, already invited, has an early-access request, or has a verification application in progress — so you don't double-invite.

## Current state (verified)

- `CreateAgentDialog.tsx` → review step → `admin-create-user` edge function.
- `admin-create-user` already 409s on "already been registered" (auth) and on previously-deleted tombstones — but only **after** you confirm, and it does **not** check early-access signups, pending verification applications, or prior invite records.
- Table counts: `profiles` 416, `pending_verifications` 266, `agent_early_access` 100, `agent_invites` 0 (the agent-to-agent invite table is unused so far).

## What we'll build

### 1. New admin-only lookup edge function: `admin-check-agent-email`

Mirrors the existing `check-deleted-agent` pattern (admin role gate via `has_role`, service-role reads, no mutations). Given an email, it returns a structured report of every place that email already exists:

| Source | Meaning shown in dialog |
|---|---|
| `auth.users` / `profiles` | "Already has an account" (+ agent status if an agent profile exists) |
| `agent_invites` | "Invited before" (+ date, status, who invited) |
| `agent_early_access` | "Requested early access" (+ date, status) |
| `pending_verifications` | "Verification application in progress" (+ status) |
| `deleted_users` | Reuse existing tombstone match (already handled today) |

### 2. Create Agent dialog: inline pre-check on the review step

- When you reach the **Confirm invite** step (and again live as you finish typing the email on the form step), call `admin-check-agent-email`.
- Results render as an inline panel under the email field / above the confirm summary:
  - **Nothing found** → green-tinted "No existing record for this email" note.
  - **Matches found** → amber warning card listing each hit (e.g. "Registered account — agent status: invited", "Requested early access on Aug 3, 2026").
- **Blocking rule:** if the email is already registered as an active (non-deleted) account, the Confirm button is disabled — that send would fail anyway.
- **Non-blocking:** early-access requests, pending applications, and prior invites show as warnings only; you can still choose to send.
- Existing previously-deleted-agent flow stays exactly as is.

### 3. Server-side safety net

`admin-create-user` keeps its existing 409 guards unchanged (registered email, previously deleted). No schema changes; no emails are sent or modified by this work.

## Technical details

- New file: `supabase/functions/admin-check-agent-email/index.ts` (admin gate: `has_role(auth, 'admin')`; service-role client for reads).
- Edited: `src/components/admin/CreateAgentDialog.tsx` — debounced lookup + warning panel + confirm-button gating.
- Deploy the new edge function; no database migration needed.
- No emails sent as part of this change.
