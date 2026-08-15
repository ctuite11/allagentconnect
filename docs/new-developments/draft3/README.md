# New Developments MVP — Draft 3 (UNAPPLIED CODE PACKAGE)

Status: **review only. Nothing in this folder has been run, applied, or deployed.**
No migration executed, no bucket created, no RLS/grant changed, no Edge Function
deployed, no secret modified, no email sent, no frontend deployed.

The approved domain design (`../MVP_BACKEND_DESIGN_REVIEW.md`, Revision 6) is
unchanged. Draft 3 is Draft 2 plus the seven required corrections below; the product design is untouched.

## Contents

```
migrations/   01–11  complete SQL, no placeholder or prose SQL (11 = retry dispatcher)
functions/    four Edge Function sources (3 public + 1 internal retry runner) + shared helpers
diffs/        exact diffs against existing email infrastructure
tests/        Deno tests covering stream registry, idempotency, escaping
```

On apply, files relocate as:

| Draft path | Applied path |
| --- | --- |
| `migrations/NN_*.sql` | `supabase/migrations/<YYYYMMDDHHMM>_new_developments_NN_*.sql` |
| `functions/_shared/*.ts` | `supabase/functions/_shared/*.ts` |
| `functions/<name>/index.ts` | `supabase/functions/<name>/index.ts` |
| `tests/*.test.ts` | `supabase/functions/_shared/*.test.ts` |
| `diffs/*.patch` | applied in place to the named existing files |

`buildDevelopmentNotificationEmailHtml.ts` currently imports
`aacEmailTemplate.ts` / `aacPublicUrl.ts` through a `../../../../../supabase/...`
path so the draft type-checks in place; that becomes `./aacEmailTemplate.ts`
on relocation (noted inline in the file).

## Review-item resolution map

| # | Review item | Where it is resolved |
| --- | --- | --- |
| 1 | Real code, not prose | All 10 migrations and all 3 functions are complete source here |
| 2 | Stream fully wired | `migrations/10_email_stream.sql` (CHECK + classifier), `diffs/emailStreams.ts.patch` |
| 2b | `kick-email-queue` before the stream is claimable | `KICK_EXCLUDED_STREAMS` / `kickAllowedStreams()`; `diffs/kick-email-queue.index.ts.patch` — the kick path can never claim `development_notifications`; only the service-role `process-email-queue` worker can |
| 3 | Email HTML wired + escaped | `functions/_shared/buildDevelopmentNotificationEmailHtml.ts` renders into `payload.html`; the frozen `renderEmailTemplate.ts` is untouched. Escaping proved by `tests/developmentEmailHtml.test.ts` |
| 4 | Path bound to `development_id` | DB CHECK in `05_media_documents.sql`, `storage_path_belongs_to_development()` in `09_storage_policies.sql`, and an independent re-check inside `functions/development-document-url/index.ts` before signing |
| 5 | `development_shares` RLS | `07_engagement.sql` — agent may INSERT only their own actor id on a development they can currently view, SELECT only their own rows; developers get aggregate counts only via `get_development_engagement_summary()` |
| 6 | EXECUTE ACLs + `admin_notes` path | Every SECURITY DEFINER function carries `revoke all ... from public, anon` plus explicit grants; `admin_get_development_admin_notes()` / `admin_set_development_admin_notes()` in `02_developments_core.sql` (admin-gated, no service-role key in the frontend) |
| 7 | Audit/system columns + re-parenting | `stamp_development_child_common()`, `stamp_development_child_audit()`, `stamp_development_unit_changes()`, immutable `development_id`/`account_id` triggers, and column-level grants that exclude `created_by`/`updated_by`/timestamps/`published_at` |
| 8 | Executable retry/idempotency | `functions/_shared/developmentNotify.ts` (23505 = success, per-recipient keys, `notified_at` stamped only when the full set is accounted for, `retryPendingSubmissions()`); RPC `list_development_submissions_awaiting_notification()`; proved by `tests/developmentNotify.test.ts` |
| 8b | 24-hour limit vs cleanup | `rate_limits_cleanup()` retention 1h → 25h in `08_helpers_rpcs.sql` |
| 9 | Repo security controls + honest rollback | `// @auth-classification: user-jwt` on all three functions, no baseline additions, `npm run security:guard` in verification, and an exact restore path for the modified email infrastructure |

Guardrails G1 (`is_active` blocks non-admin writes and agent reads/downloads,
members retain recovery access), G2 (rate-limit keys carry both `auth.uid()` and
`development_id`), and G3 (user resolved/validated before the limiter) are
carried through unchanged from the approved package.

## Test status

Run locally against the draft files (no infrastructure touched):

```
deno test --allow-env --allow-net docs/new-developments/draft2/tests/developmentNotify.test.ts \
                                  docs/new-developments/draft2/tests/developmentEmailHtml.test.ts
# 5 passed
```

`tests/emailStreams_development.test.ts` imports the live
`supabase/functions/_shared/emailStreams.ts` and therefore only passes once
`diffs/emailStreams.ts.patch` is applied. It was verified against
`diffs/emailStreams.ts.proposed` (the post-patch file): 5 passed, confirming the
stream is claimable by the worker, excluded from the kick path, and independently
pausable via `DEVELOPMENT_EMAILS_PAUSED`.

## Verification plan (post-apply, in order)

1. `npm run security:guard` — must pass with no baseline edits.
2. `supabase--linter` — zero new findings.
3. Migrations 01–10 in order; confirm every new public table has GRANTs and RLS enabled.
4. `select stream, count(*) from email_jobs group by 1` before/after migration 10 — existing rows unchanged.
5. Classifier parity: assert `email_stream_for_template()` returns the identical value for all pre-existing templates.
6. Deno tests (all four files, from their applied locations).
7. Negative RLS matrix: non-member, member of another account, eligible agent, ineligible agent, disabled account, unpublished development — for each of developments/units/media/documents/shares/leads/showings.
8. Cross-development signing attempt: create a document row under A with a path under B → expect the CHECK to reject the insert, and the function to 403 even if the row is forced in by service role.
9. Submission functions with `DEVELOPMENT_EMAILS_PAUSED=true`: rows insert, jobs enqueue, provider is never called.
10. Retry path: force a partial enqueue, confirm `notified_at` stays NULL, re-run, confirm completion with no duplicate job and no duplicate submission.

Standing rule respected: no historical replay, backfill, retry, or resend of any
existing `email_jobs` row is part of this package.

## Rollback

Per-migration rollback notes are at the bottom of each SQL file, applied in
reverse dependency order (10 → 01). Migration 10 is **not** additive: rollback
must restore the prior four-value `email_jobs_stream_check`, restore
`email_stream_for_template()` verbatim from
`supabase/migrations/20260811001056_c9a19180-3e28-4e4c-b857-b0ed3571b7b5.sql`,
and revert `emailStreams.ts` + `kick-email-queue/index.ts` using the diffs in
`diffs/`. Queued `development_notifications` rows must be settled (not replayed)
before the CHECK can be narrowed.


## Draft 3 corrections (review verdict on Draft 2)

| # | Item | Where it is fixed |
| --- | --- | --- |
| 1 | BLOCKER — `publish_status` removed from the authenticated INSERT grant; developments must start `draft` | `migrations/02_developments_core.sql` — column grant no longer lists `publish_status`, and the BEFORE INSERT trigger raises for any non-service caller attempting a non-draft insert. Publishing stays on the admin-reviewed UPDATE matrix. |
| 2 | BLOCKER — identity snapshots must use canonical `agent_profiles` | `functions/development-lead-submit/index.ts`, `functions/development-showing-request/index.ts` — snapshot reads `first_name`, `last_name`, `email`, `cell_phone` → `phone`, `company` from `agent_profiles`; the buyer `profiles` / `agent_settings` reads are gone; a lookup error returns 500 instead of silently degrading. |
| 3 | BLOCKER — `retryPendingSubmissions()` needs a real runner | New internal function `functions/development-notification-retry/index.ts` (service-role bearer only, via `internalServiceRoleAuth.ts`) + `migrations/11_notification_retry_runner.sql` (Vault-keyed `public.invoke_development_notification_retry()`, cron creation deliberately left as a post-canary rollout step). The runner rebuilds context from persisted rows, re-checks account state, and relies on the unique `idempotency_key` so retries never duplicate a send. |
| 4 | AAC-admin SELECT on saves/shares | `migrations/07_engagement.sql` — added admin-only SELECT policies on `development_saves` and `development_shares`. Developers remain aggregate-only. |
| 5 | Registry must reject reuse | `migrations/02_developments_core.sql` — `ON CONFLICT DO NOTHING` removed; a reused UUID raises `unique_violation` and rolls back the insert. |
| 6 | CTA → developer workspace; sanitize subjects | `functions/_shared/buildDevelopmentNotificationEmailHtml.ts` — CTA is `/developer/developments/:id/{leads,showings}` (id-keyed, slug-change safe) and `sanitizeSubject()` flattens all CR/LF before the subject is returned. |
| 7 | `development_from_storage_path` must fail safely | `migrations/09_storage_policies.sql` — UUID-shaped regex guard returns NULL for malformed names (no cast exception during RLS); `storage_path_belongs_to_development` now routes through it. |

Also updated: `migrations/08_helpers_rpcs.sql` (the awaiting-notification RPC now
excludes rows on disabled accounts) and `diffs/config.toml.patch`
(`development-notification-retry`, `verify_jwt = false`, JWT/service-role checked in code).

### Test status

`deno test --allow-net --allow-env tests/` → **11 passed, 0 failed**, including new
coverage for CR/LF subject injection and the developer-workspace CTA.
`tests/emailStreams_development.test.ts` imports `diffs/emailStreams.ts.proposed.ts`
(a `.ts` copy of the proposed file) so the package type-checks standalone; on apply
the import points at `supabase/functions/_shared/emailStreams.ts` and the copy is deleted.

Nothing here has been applied: no migration executed, no function deployed, no cron
scheduled, no bucket or secret touched, no email sent.
