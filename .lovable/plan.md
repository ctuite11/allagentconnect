# Profile becomes the single place for social media

Clarifications folded in:
- When `fetchSocialConnected()` returns `null`, the request may have failed or the agent may not be allowed. Profile treats `null` only as "hide the publishing connection controls" (fail closed).
- Threads is added to the `AgentProfile.tsx` social-links type, to `socialIconMap`, and to the icon renderer, so the public Threads icon appears. `social_links` stays as-is; no database change.
- When a saved profile is loaded, any missing link keys default to `""`, including `threads`.

## How it works, step by step (plain language)

**Everyday use — saving your social links (all agents):**

1. Open the sidebar and go to **Profile**. (Or open **Settings → Social Media** and click **Go to Profile** — it takes you to the same place.)
2. Scroll to the **Social Media** block. You'll see one link box per platform: Facebook, Instagram, LinkedIn, Threads, X, and Website.
3. Paste your public page or profile address into each box (for example, `https://facebook.com/yourpage`). Only fill in the ones you want shown.
4. Click **Save** on the Profile page.
5. Whatever you saved now appears as small icons on your public agent profile, so visitors can find you on those platforms.

That's all most agents will ever see and do. Typing or saving a link never signs anything up or starts any posting.

**Connecting for publishing (only admins and named test accounts right now):**

1. On the same Profile → Social Media block, each of the four publishing platforms (Facebook, Instagram, LinkedIn, Threads) also shows a line: **Publishing connection: Not connected**, with a **Connect for Publishing** button.
2. Click **Connect for Publishing**.
3. A hosted sign-in page opens in this same browser tab. Sign in to your account for that platform there.
4. When you finish, you come straight back to your **Profile → Social Media**.
5. The page reloads the connection status. The platform you authorized now says **Connected**, and the button changes to **Manage Connection**.
6. All four platforms are managed on that one hosted page together — you can go back there any time with **Manage Connection**.

**The one distinction that matters:**

- A **link** (step 3 above) = your profile icon shows that platform publicly. Nothing else.
- A **connection** = All Agent Connect is authorized to post your listing updates to that platform for you. Only created by the hosted sign-in, never by typing a link.

**If you're not in the launch group:** you see only the link boxes — no "Publishing connection" lines and no buttons. That's intentional; publishing opens up later.

## What changes for the agent

**Profile → Social Media** shows one block per platform: Facebook, Instagram, LinkedIn, Threads.

Each block has:
- **Public profile/page** — the existing link box (saved with the profile, as it is now)
- **Publishing connection** — "Connected" or "Not connected"
- Button: **Connect for Publishing** when it's not connected, **Manage Connection** when it is

X and Website stay as link-only rows. They have no publishing, so they get no connection line.

Link and connection are separate. Typing a Facebook link never marks Facebook as Connected. Only the existing sign-in flow does that.

**Settings → Social Media** becomes a short pointer: "Manage your social profile links and publishing connections from your Profile." It has a **Go to Profile** button that opens Profile scrolled to Social Media. The full connection list is removed from Settings.

## Connection flow

1. The agent clicks Connect for Publishing (or Manage Connection) on Profile.
2. The existing hosted connection page opens, the same one Settings uses today.
3. After signing in, the agent comes back to Profile → Social Media, not Settings.
4. Profile reloads the connection status on return and shows Connected for any platform that was authorized.

All buttons open the same page, because it manages all four platforms together.

## Launch gate (unchanged)

Publishing is still limited to admins and named test accounts. Everyone else sees only the link boxes on Profile, with no connection lines or buttons, just as the Settings card is hidden from them today. The Settings pointer is shown to every agent, because every agent has profile links.

## Note: Threads link is new

Today's Profile has no Threads link box. It has LinkedIn, X, Facebook, Instagram and Website. I'll add a Threads link box, saved in the same place as the other links. No database change is needed. Existing profiles just start with an empty Threads link. If a Threads link is filled in, the public profile shows a Threads icon next to the other social icons.

## Not changing

- Server functions (`social-accounts-status`, `social-connect-portal`), `agent_social_accounts`, and Bundle teams. Each agent still has one team, and it's reused.
- Publishing rules, first-publish defaults, the listing social checkboxes, and social events
- Listing status, Hot Sheets, email, DCMLS
- No social posts are sent

## Technical details

- `src/components/profile-editor/SocialLinksSection.tsx`: add `threads` to `SocialLinks`. Load connection status once with `fetchSocialConnected()`; `null` means connection status is unavailable (either gated or the request failed), so no publishing connection lines or buttons are shown. Show status and a button under the Facebook, Instagram, LinkedIn and Threads rows. Button calls `openSocialConnectPortal(returnUrl)`.
- `src/lib/socialPublishing.ts`: `openSocialConnectPortal` takes an optional `returnUrl`, defaulting to the current `/agent/settings` so other callers behave the same. Profile passes `${origin}/agent/profile#social-media`. The server already accepts any valid `returnUrl`.
- `src/pages/AgentProfileEditor.tsx`: add `threads: ""` to the default and loaded links (merged, so old rows keep their values). Add `id="social-media"` to the Social Media card, and scroll to it when the address ends in `#social-media`. Update the card description.
- `src/pages/AgentProfile.tsx`: add Threads to the social icon list, shown only when a link exists.
- `src/components/social/SocialMediaSettingsCard.tsx`: replace the body with the pointer text and a Go to Profile button (`/agent/profile#social-media`). Always shown.

## QA (no posts, no listing changes)

1. Edit and save profile links, including Threads; reload and confirm they're kept. Confirm they show on the public profile.
2. Save a Facebook link while Facebook isn't connected. Profile still says Not connected.
3. Connect for Publishing opens the real hosted connection page. Stop there unless you approve connecting an account.
4. Coming back lands on Profile → Social Media, and the status reloads. If an account is connected, it shows Connected.
5. Settings → Go to Profile opens Profile at Social Media.
6. `agent_social_accounts` still has one row for the test agent before and after, so no duplicate team.
7. The listing social checkboxes and first-publish review are unchanged. This is checked in the code only, with no publishing.
