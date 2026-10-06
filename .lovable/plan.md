# Faster navigation (items 1, 2, 3, 5) + heavy-load findings

Network Activity consolidation (#4) is excluded. No emails, publishing, database writes, backend changes, or deploys during QA.

## Part A — Heavy-load message: findings (read-only, done)

- **Where it comes from:** not AAC. The words do not exist anywhere in AAC's site, backend functions, or Netlify code, so allagentconnect.com never shows it. It is a Lovable editor / Lovable Cloud warning, raised from the database host's own resource alert.
- **The alert:** "Disk read/write budget below 50%" (value 48) at 13:04 UTC today. This is a burst allowance on the database disk that drains under sustained activity and refills when quiet.
- **Not a traffic spike:** minute-by-minute samples from 12:58 to 13:11 show steady 19–23 connections, 5 active, and no long-running work. Memory 69%, disk space 13%, no restarts.
- **Most likely cause (AAC's own workload, steady):** five background jobs run every minute around the clock: listing statuses, email queue, Hot Sheet events, message emails, and the capacity sampler. Two more run every 2 and every 5 minutes. The listing-status job alone has run its three listings scans about 15,200 times each. The daily stale-listing reminder runs at 13:00 UTC, four minutes before the alert. This is a likely contributor, unconfirmed.
- **Link to slow navigation:** weak. Navigation slowness is caused by the app (refetching about 46 requests on Back), not the database being overloaded. Heavy disk use can make each request a bit slower, though.
- **Live users:** the live site uses the same database, so if the disk budget is fully drained, every user could see slower loads. They would not see the message itself.
- **Still needed:** Lovable support should confirm the exact metric and threshold behind the editor message. Reducing the every-minute job load is a separate, later decision.

## Part B — Implementation plan

### 1. Remember Success Hub data briefly
- Wrap `useSuccessHubData` in the app's existing data cache, keyed by user, kept fresh for about 2 minutes.
- On Back, cached data renders instantly, then refreshes quietly in the background.
- Apply the same to the Success Hub sections that fetch on their own: Listing Activity, Communications, Buyers, Newest Agents, Network Activity's existing hooks. Their requests stay the same; only reuse is added.
- The cache is cleared on sign-out or account switch, so one agent never sees another's data.
- Files: `src/hooks/useSuccessHubData.ts`, `src/components/success-hub/MarketActivityRow.tsx`, `DashboardCommunications.tsx`, `networkActivity/use*.ts`, plus sign-out cache clearing in `src/hooks/useAuthRole.tsx`.

### 2. Keep scroll position on Back
- `src/components/ScrollRestoration.tsx`: save each page's scroll position. On Back/Forward, restore it once the content has painted. On normal clicks, keep resetting to the top.

### 3. One shared session check
- Hot Sheets, Success Hub data, Market Activity, Buyers list, and presence will read the already-confirmed signed-in user from the shared auth state instead of calling the account check again.
- Route protection is unchanged.
- Files: `src/pages/HotSheets.tsx`, `src/hooks/useSuccessHubData.ts`, `src/components/success-hub/MarketActivityRow.tsx`, `src/pages/success-hub/BuyersList.tsx`, `src/hooks/useAgentPresence.ts`.

### 5. Hot Sheets: load first two steps together
- `src/pages/HotSheets.tsx`: fetch hot sheets and buyer relationships at the same time. Photo lookup still follows. Same filtering and results.

## Expected improvement
- Back to Success Hub: from 1.3–4.3 s to showing the page instantly (under 0.2 s), with a quiet refresh after.
- Scroll position returns where the agent left it.
- About 4 fewer session checks per round trip, and Hot Sheets data about 0.1–0.3 s faster.

## Risks and safeguards
- **Stale data:** at most about 2 minutes old on Back, and immediately refreshed in the background. Any save or publish clears the related cache.
- **Auth:** sign-in, sign-out, route protection, and admin, delegate, and verification rules are untouched. The cache is scoped per user and cleared on sign-out or account switch.
- **Scroll:** if content is shorter on return, the position is capped at the page bottom.

## QA (non-destructive)
Signed in as Chris: go Success Hub → Hot Sheets → Back, twice. Measure timings and request counts, confirm scroll is restored, and confirm a forward click resets to the top. Then sign out and back in to confirm no carried-over data. No writes, emails, or publishes.
