# Two plans: faster navigation + lightweight capacity recorder

Nothing is implemented until approved. No deploys, emails, listing publishing, schedule changes, restarts, or resource changes. Listing-status frequency, the verified-agent lookup, Network Activity requests, and Hot Sheet/email queue frequency stay unchanged.

---

## Plan 1 — Navigation performance (items 1, 2, 3, 5)

### How caching works
- Success Hub data is kept in the app's existing data cache, keyed by the signed-in user's ID.
- **Fresh for 60 seconds.** Within that window, Back shows the saved page instantly with no refetch.
- **After 60 seconds,** Back still shows the saved page instantly, then refreshes quietly in the background. Numbers update in place, with no spinner and no blank page.
- The saved copy is dropped after 10 minutes of not visiting the page.
- The saved copy is cleared immediately when the agent:
  - signs out or switches accounts
  - saves, publishes, or changes the status of a listing
  - creates, edits, or deletes a hot sheet or buyer
- Listing Activity keeps its live updates, so new activity still appears while the page is open.

### Back and scroll
- Normal clicks (sidebar, links) still open the new page at the top.
- Back and Forward put the agent back at the scroll position they left. The position is restored once the saved content has appeared. If the page is shorter now, it stops at the bottom.
- The position is remembered per visit, not permanently.

### Session reuse
- Pages read the already-confirmed signed-in user from the shared sign-in state instead of asking the server again. That removes about 4 extra checks per round trip.
- Route protection, admin/delegate/verification rules, and sign-in/sign-out behavior are unchanged.

### Hot Sheets
- Hot sheets and buyer relationships load at the same time instead of one after the other.
- Photos still load after them.
- Filtering and results are identical.

### Expected timings (measured in the preview today; re-measured after the change)

| Step | Before | After (target) |
|---|---|---|
| Back to Success Hub | 1.3–4.3 s | under 0.2 s from the saved copy |
| Data requests on Back (live site) | about 46 | 0 within 60 s; a background refresh after that |
| Scroll after Back | reset to top | restored |
| Hot Sheets data ready | about 0.6–0.9 s | about 0.4–0.7 s |

### Risks
- **Stale data:** at most 60 seconds old on Back, refreshed immediately in the background, and cleared on any of the agent's own changes. Another agent's new listing could appear up to 60 seconds later than today, except in Listing Activity, which stays live.
- **Auth:** the cache is scoped per user and wiped on sign-out or account switch, so no data carries between accounts. Route guards are untouched.

### QA (non-destructive)
Signed in as Chris:
1. Success Hub → Hot Sheets → Back, twice. Record timings and request counts.
2. Confirm scroll is restored on Back and reset on a forward click.
3. Sign out and back in: no carried-over data.

No writes, emails, or publishes.

### Technical details
- `src/hooks/useSuccessHubData.ts`: move the loader into a `useQuery` (`['success-hub', userId]`, `staleTime: 60_000`, `gcTime: 600_000`). Use the user from `useAuthRole()` instead of `auth.getUser()`.
- Success Hub sections: `MarketActivityRow.tsx` (keeps its realtime subscription; initial fetch cached), `DashboardCommunications.tsx`, `DashboardBuyersTable` data, `networkActivity/useNewestVerifiedAgents.ts`, `useChannelPreviews.ts`, `useActiveBuyerDemand.ts`. Only caching is added; their requests are unchanged, and Network Activity consolidation is excluded.
- `src/hooks/useAuthRole.tsx`: `queryClient.clear()` on sign-out and on user-ID change.
- Invalidate `['success-hub']` after existing listing save/publish/status and hot sheet/buyer mutations, at their current success callbacks.
- `src/components/ScrollRestoration.tsx`: use `useNavigationType()`. On `POP`, restore the saved `[data-app-scroll-root]` scroll from `sessionStorage` keyed by `location.key` after the next paint. On `PUSH`/`REPLACE`, reset to top as today.
- `src/pages/HotSheets.tsx`: use the `useAuthRole` user. Run `Promise.all` for `hot_sheets` and `client_agent_relationships`.
- `src/pages/success-hub/BuyersList.tsx`, `src/hooks/useAgentPresence.ts`: use the shared user instead of `auth.getUser()`.

---

## Plan 2 — Capacity recorder (keep monitoring, cut the load)

### What is wrong (confirmed by reading the recorder)
- **Expensive pruning:** every minute the recorder deletes samples older than 7 days. The table has no index on the sample time, so each run reads the whole table. That's about 101 million rows read since the restart. The same delete hit time-outs 8 times during yesterday's incident.
- **The bug behind the 8 failed runs:** the recorder labels each connection as "app:user". Some background database workers have no user name, which produces an empty label, and the run fails ("key must not be null").

### Recommended fix (combination)
1. **More targeted delete:** add an index on the sample time, so pruning touches only the few expired rows instead of the whole table.
2. **Less frequent pruning:** prune once an hour instead of every minute, inside the same job. History stays at about 7 days, plus up to 1 hour.
3. **Fix the bug:** label workers with no user name as "unknown", so every run succeeds.
4. **Keep 1-minute sampling.** It's needed to catch the minutes before a restart, and with the fixes above the cost of sampling itself is tiny: a few system-view reads and one small row insert.

Less frequent sampling is not recommended. It would lose the resolution that makes the recorder useful, and the cost was the pruning, not the sampling.

### Expected effect
- Disk and buffer reads from the recorder drop from reading the whole table about 1,440 times a day to a small indexed delete 24 times a day. That's a reduction of over 99%.
- No more failed runs.
- The same 7-day, 1-minute history.

### Safety
- One migration: create the index, and replace the recorder function with the "unknown" label fix and the hourly pruning.
- The schedule and job name stay the same, no rows are deleted beyond the normal 7-day pruning, and no other jobs are touched.
- The index is built on a table of about 10,000 rows, which takes well under a second.
- Rollback: restore the previous function definition, which is saved before the change.

### Technical details
- `CREATE INDEX db_capacity_samples_sampled_at_idx ON public.db_capacity_samples (sampled_at);`
- In `sample_db_capacity()`: `coalesce(v_row.usename::text,'unknown')` and `coalesce(application_name,'unknown')` when building keys. Wrap pruning in `if extract(minute from now()) = 0 then delete ... where sampled_at < now() - interval '7 days'; end if;`.

---

## Message for Lovable Support (for Chris to send)

> Project: All Agent Connect (allagentconnect.com), Lovable Cloud.
>
> 1. **Background job failure window — Oct 5, 2026, 17:06–20:43 UTC.**
>    - 530 scheduled database jobs failed with "job startup timeout".
>    - Several more failed with "canceling statement due to statement timeout", including routine inserts.
>    - Affected jobs: every-minute email queue, Hot Sheet events, listing statuses, message emails, and our diagnostic recorder.
>    - Before and after that window the same jobs succeed in about 0.5 s.
>    - Questions: What happened to the database or job scheduler during that window? Was it a platform event or maintenance, resource throttling, or something our project triggered? Were HTTP calls queued by our jobs delayed or dropped?
> 2. **"Heavy load" warning in the editor — Oct 6, 2026, 13:04 UTC.**
>    - The resource alert shows "Disk IO budget below 50%" (value 48).
>    - Connections were steady at 21–23 of 60, with 5 active and no long transactions.
>    - Questions: What exact metric and threshold drive the editor's heavy-load message? How quickly does the disk budget refill? Is our instance size adequate for a steady every-minute job workload?
> 3. **Context.**
>    - About 238,000 rolled-back transactions over 10.8 days, with no matching errors in database logs. Can you confirm these are platform-internal (pooler or realtime) and harmless?
>    - The database has not restarted since Sep 25.
