
The user wants domain guidance, no code changes. Let me check current project URLs and any custom domain setup.

Current project URLs (from context):
- Preview: https://id-preview--95492335-3a75-4285-8d44-828003cae42a.lovable.app
- Published: https://allagentconnect.lovable.app
- Custom domain already attached: https://allagentconnect.com

Key consideration: This single project serves BOTH brands (AAC + DCMLS) via the shared-database architecture. There's no separate `/dcmls` route — DCMLS surfaces are integrated (badge on cards, "DCMLS Only" filter, "Homes You Won't Find Anywhere Else" homepage section). So `directconnectmls.com` would land on the same `/` homepage as `allagentconnect.com` unless we add domain-based routing later (out of scope).

# Domain Move Plan: directconnectmls.com → allagentconnect project

## 1. Project confirmation

Yes — this `allagentconnect` project (ID `95492335-3a75-4285-8d44-828003cae42a`) is the real DCMLS build. Evidence:
- DCMLS publish system lives here (`publish_to_dcmls`, `dcmls_status` columns on `listings`)
- DCMLS UI surfaces just shipped here: badge on listing cards, "DCMLS Only" search filter, "Homes You Won't Find Anywhere Else" homepage section
- Add/Edit Listing flows write DCMLS fields here (`AddListing.tsx`, `EditListing.tsx`)
- 59 listings live in this project's database; 2 currently flagged published-to-DCMLS

The standalone "DCMLS" Lovable project you currently have `directconnectmls.com` attached to is the wrong one — it has none of this.

## 2. Target URL in this project

Point `directconnectmls.com` at this project's published deployment:
- **Published URL**: `https://allagentconnect.lovable.app`
- Already-attached custom domain (for reference): `https://allagentconnect.com`

Both `allagentconnect.com` and (after the move) `directconnectmls.com` will serve the same app from this project.

## 3. Detach from the wrong project

In the **standalone DCMLS Lovable project**:
- Open Project Settings → Domains
- Remove `directconnectmls.com`
- Remove `www.directconnectmls.com`
- Wait ~1–2 minutes for the removal to register before re-attaching elsewhere

## 4. Attach to this project

In **this allagentconnect project** → Project Settings → Domains → Connect Domain:
1. Add `directconnectmls.com` (root)
2. Add `www.directconnectmls.com` separately (www is not auto-added)
3. At your DNS registrar set:
   - `A` record: name `@`, value `185.158.133.1`
   - `A` record: name `www`, value `185.158.133.1`
   - `TXT` record: name `_lovable`, value provided by the connect dialog
4. If you use Cloudflare proxy, expand "Advanced" in the connect dialog and check "Domain uses Cloudflare or a similar proxy" (switches to CNAME verification)
5. Wait for status to move: Verifying → Setting up → Active (usually minutes; up to 72h max)

## 5. Primary domain choice

This project will then have three custom domains attached:
- `allagentconnect.com` (already Active)
- `directconnectmls.com` (new)
- `www.directconnectmls.com` (new)

Recommendation:
- Keep `allagentconnect.com` as the **Primary** for the AAC brand (it's already live, SEO established, sitemap and `robots.txt` reference it)
- For the DCMLS pair, set `directconnectmls.com` as the primary between the two so `www.directconnectmls.com` 301s to it (cleaner canonical, matches `allagentconnect.com`'s www-less convention)

Important caveat (no code change requested, just so you know what to expect):
- Both domains will serve the **same homepage and the same app**. There is no domain-aware routing yet, so `directconnectmls.com/` will look identical to `allagentconnect.com/`. Visitors will see the AAC consumer homepage with the new "Homes You Won't Find Anywhere Else" DCMLS section embedded.
- If you want `directconnectmls.com` to land on a DCMLS-specific surface (e.g., auto-apply the DCMLS-only filter, different hero, different brand), that's a follow-up code task — say the word and I'll plan it.

## What I'm NOT doing
- No app code changes
- No schema changes
- No SEO/sitemap/robots edits
- No domain-based routing logic (separate task if you want it)

## Verification checklist after attach
- `directconnectmls.com` status = Active in Project Settings → Domains
- `www.directconnectmls.com` status = Active
- Visiting `https://directconnectmls.com` loads the same homepage as `https://allagentconnect.com`
- The DCMLS section "Homes You Won't Find Anywhere Else" renders with the 2 currently-published listings
