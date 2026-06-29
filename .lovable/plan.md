## Goal
Stop public Request Access traffic from creating auth accounts directly, and keep Admin Pending/Verified tabs based on real verification status.

## Plan
1. **Repoint public Request Access CTAs to Early Access**
   - Change homepage/public AAC CTAs from `/auth?mode=register` to `/register`.
   - Include both active homepage variants found in `src/components/home-v2/*` and legacy `src/pages/Home.tsx` surfaces.
   - Keep buyer/shared-listing invite signup links untouched because those are guest/invite account flows, not agent early-access marketing CTAs.

2. **Update legacy redirects**
   - Change agent onboarding-style redirects in `src/App.tsx` (`/choose`, `/get-started`, `/onboarding`, `/verify-agent`, etc.) from `/auth?mode=register` to `/register` so old public links cannot bypass Early Access.

3. **Add a guard on direct agent signup URL**
   - In `src/pages/Auth.tsx`, if someone opens `/auth?mode=register` without a legitimate invite/deep-link context, redirect them to `/register`.
   - Preserve allowed direct-account contexts such as shared listing return flows or buyer workspace invite flows, so existing invite acceptance paths do not break.

4. **Keep Admin status tabs truthful**
   - Confirm/keep the existing `AdminApprovals.tsx` correction: Verified means `agent_status === 'verified'`, Pending means auth account exists with `agent_status === 'pending'`, Unverified remains early-access leads without auth.

## Verification
- Search confirms no public AAC Request Access/Get Access CTA still points to `/auth?mode=register`.
- `/auth?mode=register` entered directly routes to `/register`.
- Invite/deep-link signup routes that need direct account creation still reach auth registration.
- Admin Verified/Pending logic remains based on `agent_status`, so Michelle and Emily stay Pending and can receive the License Verified email from the admin UI.