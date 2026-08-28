---
name: Production monitoring Phase 1 locked
description: system-health endpoint/RPC deployed; external monitor config owned by user; do not change thresholds or code until real data collected
type: constraint
---

Phase 1 production monitoring is deployed and locked (Aug 2026):
- `system-health` Edge Function (token-protected, verify_jwt=false, bearer = SYSTEM_HEALTH_MONITOR_TOKEN) + service-role-only `public.get_system_health()` RPC. Read-only, no PII.
- Rollup: critical→503, degraded→200, paused→200, healthy→200. Pause-aware per email stream.
- Do NOT change thresholds, add alerts for `degraded`, or modify monitoring code until 1–2 weeks of real production data is collected and the user explicitly approves.
- External monitors (uptime service, cadence, alert channels) are configured by the user outside AAC — not our code.
- Alerting must stay independent of AAC's own email queue.
- Phase 2 (frontend error monitoring / synthetic browser check) is a separate, future, explicitly-approved effort. An HTTP 200 on /login does not prove React rendered.
