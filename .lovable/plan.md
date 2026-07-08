# Agent profile audit — who needs a "set up your profile" email

Read-only audit of `agent_profiles` + `agent_settings`. No code, no DB changes.

## Headline numbers

- Total agents in `agent_profiles`: **187**
- Onboarding **never started**: **186**
- Onboarding started, not completed: **1**
- Onboarding completed: **0**
- Missing headshot: **142**
- Missing brokerage/company: **49**
- Missing phone: **31**
- Missing first/last name: **0**
- **Agents missing at least one of headshot / company / phone → 148**

Definition used for "needs setup email" (matches `checkProfileComplete` in `src/hooks/useAgentSettings.ts`): missing any of headshot_url, company, or phone/email contact. Name is present for everyone.

## Recommended segments for the email

1. **Priority A — 142 agents missing a headshot.** Highest-visibility gap; drives their public profile card. Single CTA: "Add your headshot."
2. **Priority B — 49 agents missing brokerage** (subset overlaps with A). CTA: "Add your brokerage."
3. **Priority C — 31 agents missing phone.** CTA: "Add a contact number."
4. **Combined blast** — 148 unique agents missing at least one field. One email, dynamic checklist of what's missing.

Onboarding-state overlay (independent axis):
- 186 have `onboarding_started = false` → they've never touched onboarding. Same email works; softer copy ("Finish setting up your profile").
- 1 started but didn't finish → "Pick up where you left off."

## Deliverable

Once approved, in build mode I will:
1. Export a CSV to `/mnt/documents/agent-profile-setup-needed.csv` with columns:
   `id, email, first_name, last_name, company, phone, headshot_url, onboarding_started, onboarding_completed, missing_fields (comma-separated), created_at`
   — one row per agent in the 148 "needs setup" set, sorted by most-missing-fields first.
2. Print top-of-list summary (first ~20 rows) in chat so you can eyeball it.

Nothing else changes — no emails sent, no schema touched, no code edited. Sending the email itself is a separate follow-up decision (which template, from which address, subject line).

## Open questions before I export

- Do you want the CSV scoped to the **148 missing-any-field** set, or the stricter **142 missing-headshot** set, or **all 187** with a `needs_email` flag column?
- Should I exclude any admin/test accounts (e.g. your own `chris@allagentconnect.com`, the default founder id `1fc50da1-…`)?
