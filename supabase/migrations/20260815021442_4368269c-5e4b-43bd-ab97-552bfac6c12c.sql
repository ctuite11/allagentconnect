-- New Developments: align raw grants with the approved access matrix.
-- No policy in the package targets anon/public, so anon must hold no privileges.
revoke all on public.development_accounts from anon;
revoke all on public.development_account_members from anon;
revoke all on public.developments from anon;
revoke all on public.development_id_registry from anon;
revoke all on public.development_buildings_phases from anon;
revoke all on public.development_floor_plans from anon;
revoke all on public.development_units from anon;
revoke all on public.development_updates from anon;
revoke all on public.development_media from anon;
revoke all on public.development_documents from anon;
revoke all on public.development_sales_contacts from anon;
revoke all on public.development_saves from anon;
revoke all on public.development_shares from anon;
revoke all on public.development_leads from anon;
revoke all on public.development_showing_requests from anon;

-- === ROLLBACK ===
-- (Restoring the legacy blanket anon grants is intentionally not provided.)