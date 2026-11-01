# Privacy lockdown: owner decisions and public function review (2026-11-01)

Status: preparation only. Nothing is deployed. No changes to Weborik's environment without Nenad's agreement.

## Owner decisions (Chris Tuite)

1. **No photo grace period.** Confidential property photos move to private storage during the coordinated security release, not 90 days later.
   - Impact: images in emails sent before the release that point at the old public photo addresses will stop displaying.
   - What still works: the links in those emails (Hot Sheet and share links) keep working if they are still valid. After the buyer opens the link, authorized photos load through the photo service (Option B). Reusable access codes are never put inside image addresses.
   - Safer alternative to keep old emails readable without public exposure: replace photos in old emails with a neutral "View photos securely" placeholder at the old address. The placeholder shows no property imagery and links to the secure page. Needs Nenad's hosting or redirect support. Not yet built.
2. **Contact card.** Buyers see the **sharing agent**, labelled "Your Agent" / "Shared by". The listing agent's contact details are never shown to buyers automatically.
3. **External sharing permission.** Being visible to verified AAC agents does **not** allow sharing outside AAC. An external share link can be created only when the listing explicitly allows external sharing under its marketing restrictions and the seller's instructions. Default: not allowed. Off-market and coming-soon listings need an explicit opt-in recorded by the listing agent. Required change to 03_secure_share_links_up.sql: add a listing-level "external sharing allowed" setting (default off) and check it in the link-creation function, with tests: creation is refused when the setting is off; links stop working once it is switched off.
4. **Expired, revoked or obsolete links.** These show a neutral "This link is no longer available. Ask your agent for a new link" page. The page shows no address, price, photo, description, preview data or agent detail. Social preview data for these links is generic too.

## Replacement-link process

- **Agents:** My Listings → listing → "Share externally" (shown only when external sharing is allowed) → create link (single listing, expiry date, revocable). Lists the agent's active links with Revoke / Replace. Replace revokes the old link and issues a new one.
- **Buyers:** opening an old or expired link shows the neutral page with "Ask your agent for a new link". If the buyer is signed in, the page also offers a "Request new link" button that notifies the sharing agent. It never notifies the listing agent and never shows listing data.
- **Previously sent public /property/ links:** after release these show the neutral page to signed-out visitors. Agents re-share with the process above.

## Interfaces: status

The agent and buyer share-link screens are specified above but **not added to the live site yet**. This site publishes every saved website change straight to allagentconnect.com, so adding them now would put them live before approval. They'll be built in an isolated preview or Weborik staging copy, tested there, and only merged at the coordinated release.

## Public backend function review (live, read-only inventory)

104 public database functions can currently be called by signed-out visitors (anon EXECUTE). 49 of these run with elevated privileges (SECURITY DEFINER) and have **no** sign-in/role check in their body:

agent_dcmls_participating, agent_end_client_relationship_by_id, archive_conversations_between_users, auto_activate_listings, build_message_email_payload, check_hot_sheet_matches, cleanup_blocking_auth_identity, cleanup_expired_share_tokens, cleanup_orphan_auth_identity, count_matching_agents, developer_is_activation_eligible, effective_agent_id, ensure_agent_role_for_user, generate_aac_id, generate_listing_number, get_agent_presence, get_client_favorites_for_agent, get_dcmls_listing, get_delegate_invite_preview, get_hot_sheet_by_token, get_listing_interest_signals, get_newest_verified_agents, get_public_agent_profile, get_public_listing, get_public_listing_agent, get_verified_agent_ids, get_verified_early_access_count, has_role, hot_sheet_has_shared_workspace_recipients, invoke_process_comms_digests, invoke_process_hot_sheet_events, is_buyer_represented_by_other_agent, is_developer, is_email_registered_with_aac, is_email_unsubscribed, is_team_delegate, is_team_lead, is_team_member_visible, is_team_owner, is_verified_agent_for_context, listing_row_exists, listings_within_radius, normalize_listing_address_text, process_pending_message_emails, rate_limit_consume, remove_client_favorite_for_agent, reserve_and_enqueue_missing_opportunity_reminder, resolve_share_token, verify_buyer_contact_row

Proposed treatment (to be tested in staging, not applied):
- **Revoke from signed-out visitors and signed-in users, keep for the system only:** auto_activate_listings, cleanup_*, invoke_process_*, process_pending_message_emails, reserve_and_enqueue_missing_opportunity_reminder, build_message_email_payload, ensure_agent_role_for_user, archive_conversations_between_users, agent_end_client_relationship_by_id, generate_aac_id, generate_listing_number, rate_limit_consume.
- **Revoke from signed-out visitors, verified agents only:** get_public_listing, get_public_listing_agent, get_public_agent_profile, get_dcmls_listing, listings_within_radius, get_newest_verified_agents, get_verified_agent_ids, get_agent_presence, get_listing_interest_signals, count_matching_agents, check_hot_sheet_matches, get_client_favorites_for_agent, remove_client_favorite_for_agent.
- **Keep for signed-out visitors, but token-bound and stripped of extra data:** get_hot_sheet_by_token, resolve_share_token (replaced by the secure share-link function), get_delegate_invite_preview, verify_buyer_contact_row.
- **Lets anyone check whether an email is on file. Change to rate-limited yes/no only, or remove signed-out access:** is_email_registered_with_aac, is_email_unsubscribed.
- **Helpers used by permission rules:** has_role, is_* helpers. Remove signed-out access unless a rule for signed-out visitors needs them.
- **Remaining 55 functions** do contain a sign-in or role check. Signed-out access is still removed by default, and each body gets a manual review in staging.

Caveat: the "no check" flag comes from a text search of each function's code. Every function still needs a manual review in staging.
