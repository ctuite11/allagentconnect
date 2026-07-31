# Controlled email restart (manual approvals only)

No stage may automatically advance. No automatic reopen.

## Ground Zero boundary

- America/New_York: `2026-07-31 00:00:00`
- UTC: `2026-07-31 04:00:00`

Everything created before that timestamp is historical and permanently unclaimable.

## Required sequence

Separate human approvals for each stage:

1. Internal canary
2. Transactional
3. Hot Sheet
4. Communications

## Before any stage

- Keep `EMAIL_SENDING_PAUSED=true` until that stage is explicitly approved
- Clear only the approved `email_control_state` pause flags
- Review `email_jobs` queued / processing / quarantined
- Keep active email crons at `0` until that stage is approved
- Do not send production canaries from this PR alone

This document is operational guidance. The database does not auto-advance stages.
