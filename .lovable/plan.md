

## Root cause

The global `<Navigation />` component (AAC header) renders on all routes except `HIDE_NAV_ROUTES` / sidebar-managed routes. On `directconnectmls.com`, consumer routes like `/saved`, `/searches`, `/account`, `/find-agent`, `/browse` render **both** the AAC `Navigation` AND the `DcmlsConsumerHeader` → double header (visible in screenshot).

The DCMLS header itself is correct. The fix is to suppress the global AAC Navigation entirely on the DCMLS host.

## Fix (one file)

**`src/components/Navigation.tsx`** — add a host check at the top of the render guard:

```ts
// DCMLS host is consumer-only and uses DcmlsConsumerHeader on every page.
// The global AAC Navigation must never render there.
if (isDcmlsHost()) return null;
```

Place this immediately before the existing `HIDE_NAV_ROUTES.includes(...)` check (around line 253), and add the import for `isDcmlsHost` from `@/lib/host`.

## Result after publish

- `directconnectmls.com` shows **only** the DCMLS consumer header (Browse, Agent Search, Saved Homes, Hot Sheets, Account, Sign Out when logged in; Browse, Agent Search, Sign In, Create Account when logged out).
- AAC host (`allagentconnect.com`) is unaffected — global Navigation continues to render exactly as before.
- No agent-facing UI is reachable from the DCMLS surface.

## Files changed
- `src/components/Navigation.tsx` (add host guard + import)

## Test
- Publish, then on `directconnectmls.com` visit `/`, `/saved`, `/searches`, `/account`, `/browse`, `/find-agent` → only one header (DCMLS).
- On `allagentconnect.com` visit `/favorites`, `/browse` → AAC Navigation still renders as before.

