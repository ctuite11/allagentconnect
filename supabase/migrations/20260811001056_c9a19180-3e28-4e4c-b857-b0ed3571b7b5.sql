CREATE OR REPLACE FUNCTION public.email_stream_for_template(p_template text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_template
    -- ---- Hot Sheet / listing-update stream (isolated) ----
    WHEN 'new-match-notification' THEN 'hot_sheet'
    WHEN 'hot-sheet-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-update' THEN 'hot_sheet'
    WHEN 'hot-sheet-alert' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast-test' THEN 'hot_sheet'
    WHEN 'hot-sheet-invite' THEN 'hot_sheet'
    WHEN 'hot-sheet-comment' THEN 'hot_sheet'
    WHEN 'hot-sheet-agent-reply' THEN 'hot_sheet'
    WHEN 'price-change-notification' THEN 'hot_sheet'
    WHEN 'stale-listing-reminder' THEN 'hot_sheet'
    WHEN 'buyer-alert' THEN 'hot_sheet'
    WHEN 'seller-alert' THEN 'hot_sheet'
    WHEN 'reverse-prospecting' THEN 'hot_sheet'

    -- ---- Communications Center stream ----
    WHEN 'client-need-broadcast' THEN 'communications'
    WHEN 'client-need-notification' THEN 'communications'
    WHEN 'comms-digest' THEN 'communications'
    WHEN 'comms-center-guide' THEN 'communications'
    WHEN 'agent-activation-nudge' THEN 'communications'
    WHEN 'bulk-email' THEN 'communications'
    WHEN 'bulk-email-group' THEN 'communications'

    -- ---- Transactional (agent/client initiated + account lifecycle) ----
    WHEN 'agent-profile-contact' THEN 'transactional'
    WHEN 'listing-contact-inquiry' THEN 'transactional'
    WHEN 'agent-client-email' THEN 'transactional'
    WHEN 'client-agent-message' THEN 'transactional'
    WHEN 'new-message-notification' THEN 'transactional'
    WHEN 'showing-request' THEN 'transactional'
    WHEN 'listing-share' THEN 'transactional'
    WHEN 'bulk-listing-share' THEN 'transactional'
    WHEN 'favorites-share' THEN 'transactional'
    WHEN 'buyer-workspace-invite' THEN 'transactional'
    WHEN 'account-delegate-invite' THEN 'transactional'
    WHEN 'team-invite' THEN 'transactional'
    WHEN 'team-request-notification' THEN 'transactional'
    WHEN 'team-decision' THEN 'transactional'
    WHEN 'agent-invite' THEN 'transactional'
    WHEN 'admin-created-invite' THEN 'transactional'
    WHEN 'agent-forward-invite' THEN 'transactional'
    WHEN 'personal-forward-invite' THEN 'transactional'
    WHEN 'founder-invite-1to1' THEN 'transactional'
    WHEN 'welcome-email' THEN 'transactional'
    WHEN 'license-verified' THEN 'transactional'
    WHEN 'agent-login-link' THEN 'transactional'
    WHEN 'agent-approval-accepted' THEN 'transactional'
    WHEN 'agent-account-removed' THEN 'transactional'
    WHEN 'agent-temp-password' THEN 'transactional'

    -- ---- System / admin operational ----
    WHEN 'agent-verification-submitted' THEN 'system'

    ELSE NULL
  END;
$function$;