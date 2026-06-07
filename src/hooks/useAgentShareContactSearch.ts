import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ContactSearchResult } from "@/components/share/ShareListingsDialog";
import {
  AGENT_SHARE_CONTACT_MIN_QUERY_LENGTH,
  filterAgentContactsForSharePicker,
  invalidateAgentContactsCache,
} from "@/lib/contactSearch";

const SEARCH_DEBOUNCE_MS = 280;

/** CRM contact search for listing/hot-sheet share dialogs — same list as /my-clients. */
export function useAgentShareContactSearch(open: boolean, enabled = true) {
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactSearchResult[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  const resetContactSearch = useCallback(() => {
    setContactQuery("");
    setContactResults([]);
    setShowContactDropdown(false);
    setIsSearchingContacts(false);
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
    if (!open || !enabled || !agentId) {
      setContactResults([]);
      setShowContactDropdown(false);
      setIsSearchingContacts(false);
      return;
    }

    const q = contactQuery.trim();
    if (q.length < AGENT_SHARE_CONTACT_MIN_QUERY_LENGTH) {
      setContactResults([]);
      setShowContactDropdown(false);
      setIsSearchingContacts(false);
      return;
    }

    let cancelled = false;
    setIsSearchingContacts(true);

    const timer = setTimeout(async () => {
      try {
        const results = await filterAgentContactsForSharePicker<ContactSearchResult>({
          agentId,
          query: q,
        });
        if (cancelled) return;
        setContactResults(results);
        setShowContactDropdown(true);
      } catch (error) {
        console.error("[useAgentShareContactSearch] search failed", error);
        if (!cancelled) {
          setContactResults([]);
          setShowContactDropdown(true);
        }
      } finally {
        if (!cancelled) setIsSearchingContacts(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contactQuery, open, enabled, agentId]);

  const handleContactSearchFocus = useCallback(() => {
    if (contactQuery.trim().length >= AGENT_SHARE_CONTACT_MIN_QUERY_LENGTH) {
      setShowContactDropdown(true);
    }
  }, [contactQuery]);

  const refreshContacts = useCallback(async () => {
    if (!agentId) return;
    invalidateAgentContactsCache();
    const q = contactQuery.trim();
    if (q.length < AGENT_SHARE_CONTACT_MIN_QUERY_LENGTH) return;

    try {
      const results = await filterAgentContactsForSharePicker<ContactSearchResult>({
        agentId,
        query: q,
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
    isSearchingContacts,
    dismissContactDropdown: () => setShowContactDropdown(false),
    handleContactSearchFocus,
    resetContactSearch,
    refreshContacts,
  };
}
