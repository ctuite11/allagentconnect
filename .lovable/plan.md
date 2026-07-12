## Add Team Account CTA to Agent Profile edit page

Place a prominent **Create a Team Account** button near the top of the agent's profile edit page, in addition to the existing entry in Agent Settings.

### Where
- File: the agent-facing profile edit page (the "Edit Profile" / agent profile screen users land on to edit their own public profile).
- Position: directly under the page header/title, above the first form section.

### What it looks like
- A compact banner/card row aligned to the page container:
  - Left: short label — "Have a team? Get a shared Team Profile while keeping your individual agent profile."
  - Right: primary button "Create a Team Account" → navigates to `/team/request`.
- Uses existing design tokens (AAC Primary Blue, standard Card/Button components). No new visual patterns.

### Visibility rules
- Shown only to authenticated verified agents (`isVerifiedAgent`).
- If the agent already has an **accepted** team membership (one-team-at-a-time rule already enforced in DB), swap the CTA to a subtle "Manage Team Account" link → `/team/:id/manage` instead of the create CTA.
- If the agent has a **pending** team request they created, show a muted "Team Account request pending review" pill (no button), linking to `/team/:id/manage`.

### Data
- Lightweight query on mount: fetch the current user's row in `team_members` (status in `accepted`/`invited`) plus any `teams` they created with `status='pending'`. Single Supabase call, no schema changes.

### Out of scope
- No changes to Agent Settings card (stays as a secondary entry point).
- No changes to the public agent profile page.
- No layout/redesign of the profile edit page itself.

### Files touched
- The agent profile edit page component (one file) — add the CTA block and the small membership-status query.
