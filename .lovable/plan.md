Edit `buildFoundingPartnerBody()` in `supabase/functions/send-bulk-email/index.ts`, then redeploy `send-bulk-email`.

### 1. CTA button (line 303)
Replace "Accept your invitation →" with **"Become a Founding Partner →"**.

### 2. Referral network description (line 269)
Replace:
> Vetted agents in every market with scrape-protected profiles and a clean way to send and receive referrals.

With:
> Build trusted relationships with vetted agents across Massachusetts before public launch. Send referrals, share opportunities, and grow your network with agents who are helping shape the platform.

### 3. New "Founding Partner Benefits" block
Insert a new `<tr>` between the benefits grid (line 301) and the CTA row (line 302). Styling matches existing card aesthetic: subtle card with emerald accent bar, uppercase eyebrow, checkmark list.

```
FOUNDING PARTNER BENEFITS
─── (emerald 32x2 bar) ───
✓ Lifetime Founding Partner designation
✓ Direct input into future features
✓ Invitation to private roundtable discussions
✓ Early visibility within the AAC network
✓ Help shape the future expansion of AAC and Direct Connect MLS
```

Implementation: a single `<td>` with `padding:40px 0 0;`, an h2 eyebrow matching the existing `text-transform:uppercase;letter-spacing:0.04em;color:#0f172a;` style, the same 32×2 `#22C55E` divider used in benefit cards, then a `<ul>` (or stacked `<p>` rows with green `✓` glyph in `#22C55E`) at 14px / line-height 1.7 / color `#334155`. Email-safe: use inline styles, no flexbox; use a table with two columns per row (check glyph cell + text cell) to guarantee Outlook alignment.

### 4. Tighten closing (line 306)
Keep current first paragraph as-is, then add a second paragraph immediately after:
> The agents helping shape AAC today will have a unique opportunity to help guide its growth tomorrow.

Same `<p>` styling as the existing closing paragraph; `margin:0 0 16px;`.

### 5. Redeploy
Deploy `send-bulk-email` so the new copy is live.

### Out of scope
No changes to headline, quote block, screenshots, signature, or footer disclaimer. No template/router changes elsewhere.
