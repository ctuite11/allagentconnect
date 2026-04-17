
Root cause confirmed: the published DCMLS site is live, but the homepage still uses the old `src/pages/DcmlsHome.tsx` nav and hero CTAs. The newer consumer-first header exists in `src/components/dcmls/DcmlsConsumerHeader.tsx`, and `/consumer/auth` is live, but the homepage itself was never switched to use that consumer-first surface.

Plan:
1. Update `src/pages/DcmlsHome.tsx`
   - Replace homepage top-right `Agent Sign In` CTA with:
     - `Sign In`
     - `Create Account`
     - small secondary `Agent Login`
   - Update hero CTA block to consumer-first CTAs as well.
   - Point primary auth links to `/consumer/auth?mode=signin` and `/consumer/auth?mode=signup`.

2. Reuse the canonical DCMLS header
   - Prefer rendering `DcmlsConsumerHeader` on the homepage so the homepage and inner DCMLS pages stay consistent.
   - Keep AAC domain behavior unchanged.

3. Verify directconnectmls.com testing flow
   - Homepage shows consumer-first CTAs.
   - `Create Account` opens buyer signup.
   - `Sign In` opens buyer sign-in.
   - `Agent Login` still routes to `/auth`.
   - Anonymous save/favorite redirects remain pointed to `/consumer/auth?mode=signup&from=<current-path>`.

Files to change:
- `src/pages/DcmlsHome.tsx`
- possibly minor shared styling alignment in `src/components/dcmls/DcmlsConsumerHeader.tsx` only if needed for homepage parity

Expected result after publish:
- `directconnectmls.com` homepage visibly shows the new consumer funnel
- buyers can test the full top-of-funnel directly on the live DCMLS site
- agent login remains available as a secondary path
