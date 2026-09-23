# Agent Network intro — only show for incomplete profiles

Delivered as a **separate draft** for review. Not merged, not deployed.

## Background

The Agent Network intro overlay on Our Agents has shown to every agent since June regardless of profile completeness, and its dismissal is browser-only (localStorage/sessionStorage), so it reappears in fresh browsers. Your `agent_settings` confirm the Success Hub checklist is correctly dismissed — this is a separate, older overlay. Not a regression from recent work.

## Changes

### 1. Gate on the existing profile-completeness check

- `src/hooks/useAgentNetworkIntro.ts`: reuse `checkProfileComplete` from `useAgentSettings` (the same check the Success Hub checklist uses — covers name, headshot, brokerage, contact info). No second/separate completeness test.
- Profile complete → overlay never renders. No popup, no flash, including fresh browser/incognito.
- Profile incomplete → existing behavior unchanged: same copy, same three buttons, same "Don't show this again" checkbox.
- `src/pages/OurAgents.tsx`: minimal wiring to pass the completeness result into the hook.

### 2. Account-based permanent dismissal

- Migration: add `agent_network_intro_dismissed boolean not null default false` to `public.agent_settings` (additive, nullable-safe with default; applied via the standard migration tool, types regenerate automatically).
- When "Don't show this again" is selected on any button, save `agent_network_intro_dismissed = true` to `agent_settings` (via the existing settings update path) in addition to localStorage.
- On load, the server-side flag is authoritative; localStorage stays as a fast cache and backward-compatible fallback for agents who already dismissed in-browser.

## Explicitly not touched

- Success Hub Member Setup Checklist (`useAgentProfileOnboarding` / `AgentProfileOnboardingOverlay`)
- Agent Network visibility/directory rules
- Emails, queues, Hot Sheets, unrelated backend functions
- Overlay design, copy, buttons

## Verification (in the draft)

- Type-check + lint clean.
- Complete-profile account (yours): no intro on Our Agents, including a fresh session.
- Incomplete-profile path: intro still shows (code-level verification; no test data created).

## Delivery

- Built in a separate draft; you review the diff there before anything lands on main.
- The migration is staged with the draft and applies only when the draft is accepted.
