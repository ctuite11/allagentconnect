# Stop the Agent Network intro popup for complete profiles

## What happened

The popup you saw is the Agent Network intro on the Our Agents page ("Complete your profile to appear in the Agent Network"). It is **not** the Success Hub setup checklist — your settings confirm that one is correctly dismissed (`welcome_modal_dismissed: true`, `preferences_set: true`).

The Agent Network intro has two problems:

1. **It never checks whether your profile is actually complete.** It shows to every agent who hasn't dismissed it, even though its own message only applies to agents missing a headshot or profile details.
2. **Its dismissal is browser-only** (localStorage/sessionStorage). A new browser, incognito window, or cleared storage makes it reappear — which is why it popped up for you.

## Fix

### 1. Only show the intro when the profile is genuinely incomplete

In `src/hooks/useAgentNetworkIntro.ts` (and its use in `src/pages/OurAgents.tsx`):

- Reuse the existing profile-completeness check (`checkProfileComplete` from `useAgentSettings`, the same check the Success Hub checklist uses) plus a headshot check.
- If the agent's profile is complete (headshot + required fields), the overlay never renders — no popup, no flash.
- If the profile is incomplete, behavior is unchanged: the intro shows once per session, with the same three buttons and "Don't show this again" checkbox.

### 2. Remember dismissal across browsers

- Add a `agent_network_intro_dismissed` boolean column to `agent_settings` (default `false`), via a standard timestamped migration with GRANTs.
- When an agent clicks any button with "Don't show this again" checked, save the dismissal to `agent_settings` in addition to localStorage.
- On load, the hook checks the server-side flag first; localStorage remains a fast cache.
- Agents who already dismissed it in this browser keep their dismissal (localStorage still honored).

## Explicitly not changed

- Success Hub onboarding checklist (`useAgentProfileOnboarding` / `AgentProfileOnboardingOverlay`) — already working correctly.
- The overlay's design, copy, buttons, or checkbox.
- Agent Network visibility rules, directory, or any other page.
- No emails, no queue, no backend functions.

## Files touched

- `src/hooks/useAgentNetworkIntro.ts` — add profile-completeness gate + server-side dismissal read/write.
- `src/pages/OurAgents.tsx` — pass settings/completeness into the hook (small wiring change only).
- One migration: add `agent_network_intro_dismissed` to `agent_settings`.

## Verification

- Type-check + lint clean.
- Confirm with your account (complete profile): intro does not appear on Our Agents, including in a fresh browser session.
- Confirm an incomplete-profile test path still shows the intro (code-level check; no test data created).
