import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ContactSearchResult } from "@/components/share/ShareListingsDialog";
import {
  fetchAllAgentContacts,
  filterAgentContactsForSharePicker,
  invalidateAgentContactsCache,
} from "@/lib/contactSearch";

/** CRM contact search for listing/hot-sheet share dialogs — same list as /my-clients. */
export function useAgentShareContactSearch(open: boolean, enabled = true) {
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactSearchResult[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  const resetContactSearch = useCallback(() => {
    setContactQuery("");
    setContactResults([]);
    setShowContactDropdown(false);
  }, []);

  useEffect(() => {
    if (!open || !enabled) {
      setAgentId(null);
      return;
    }

    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setAgentId(user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, enabled]);

  useEffect(() => {
    if (!open || !enabled || !agentId) return;
    void fetchAllAgentContacts(agentId).catch((error) => {
      console.error("[useAgentShareContactSearch] preload failed", error);
    });
  }, [open, enabled, agentId]);

  useEffect(() => {
    if (!open || !enabled || !agentId) {
      setContactResults([]);
      setShowContactDropdown(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await filterAgentContactsForSharePicker<ContactSearchResult>({
          agentId,
          query: contactQuery,
        });
        if (cancelled) return;
        setContactResults(results);
        setShowContactDropdown(results.length > 0);
      } catch (error) {
        console.error("[useAgentShareContactSearch] search failed", error);
        if (!cancelled) setContactResults([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contactQuery, open, enabled, agentId]);

  const handleContactSearchFocus = useCallback(() => {
    if (contactResults.length > 0) setShowContactDropdown(true);
  }, [contactResults.length]);

  const refreshContacts = useCallback(async () => {
    if (!agentId) return;
    invalidateAgentContactsCache();
    try {
      const results = await filterAgentContactsForSharePicker<ContactSearchResult>({
        agentId,
        query: contactQuery,
        forceRefresh: true,
      });
      setContactResults(results);
    } catch (error) {
      console.error("[useAgentShareContactSearch] refresh failed", error);
    }
  }, [agentId, contactQuery]);

  return {
    contactQuery,
    setContactQuery,
    contactResults,
    showContactDropdown,
    setShowContactDropdown,
    dismissContactDropdown: () => setShowContactDropdown(false),
    handleContactSearchFocus,
    resetContactSearch,
    refreshContacts,
  };
}
