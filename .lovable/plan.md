
Goal: eliminate remaining client hot sheet 404s by adding legacy route compatibility and normalizing client-side navigation paths.

Implementation steps:
1) Update client dashboard create-entry links to current route
- File: `src/pages/ClientDashboard.tsx`
- Replace both `navigate("/client/create-hotsheet")` calls with `navigate("/client/hotsheets/new")`.
- Keep existing post-create redirect to `"/client/dashboard"` in `ClientCreateHotsheetNew.tsx`.

2) Add legacy create-route redirect in router
- File: `src/App.tsx`
- Add a compatibility route:
  - `path="/client/create-hotsheet"` → `<Navigate to="/client/hotsheets/new" replace />`
- Place it near existing client routes so old bookmarks/external links no longer 404.

3) Add legacy detail-route redirect for old UUID path
- File: `src/App.tsx`
- Add redirect route for stale URLs:
  - `path="/client/hot-sheets/:id"` → `<Navigate to="/client/dashboard" replace />`
- This safely handles previously generated bad links and avoids exposing/guessing token-based detail routes.

4) Verify all client hot sheet navigation sources
- Search and normalize any remaining usage of:
  - `/client/create-hotsheet`
  - `/client/hot-sheets/`
- Ensure only these active destinations remain:
  - create: `/client/hotsheets/new`
  - open detail (token): `/client/hotsheet/:token`
  - post-create fallback: `/client/dashboard`

5) End-to-end validation checklist
- From `/client/dashboard`, click both “Create Hot Sheet” buttons (header + empty state) → lands on `/client/hotsheets/new`.
- Submit create form successfully → lands on `/client/dashboard` with no 404.
- Manually open legacy URLs:
  - `/client/create-hotsheet` → redirected to `/client/hotsheets/new`
  - `/client/hot-sheets/<anything>` → redirected to `/client/dashboard`
- Confirm no NotFound page appears in this flow.

Technical details:
- Root cause found: `ClientDashboard.tsx` still uses legacy path `/client/create-hotsheet` (not defined in routes), which triggers NotFound.
- Current valid create route in `App.tsx`: `/client/hotsheets/new`.
- Current valid client detail route is token-based only: `/client/hotsheet/:token`.
- A UUID-style client detail URL (`/client/hot-sheets/:id`) is not currently resolvable; redirecting it is the minimal safe fix for today.
