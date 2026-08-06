# DCMLS hosting/env mismatch (open, out of scope)

Logged: 2026-08-06 — surfaced during the AAC performance release smoke test. Pre-existing, unrelated to that release.

## Symptom
`directconnectmls.com` renders an app-level error stating Supabase configuration is required.

## Observation
The build served on that host has no backend env baked in (project ref grep: 0 hits), while the `allagentconnect.com` build has it. The domain appears to point at the Lovable-hosted deployment rather than the Netlify build that carries the env vars.

## Status
Not triaged, not fixed. No DNS, hosting, or backend settings were changed.

## Scope note
Explicitly excluded from the AAC speed work. Any fix requires a separate, scoped request.