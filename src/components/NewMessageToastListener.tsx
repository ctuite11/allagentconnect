import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Global listener that shows a toast popup when a new message arrives
 * for the currently logged-in user. Mounted once in App.tsx.
 */
export function NewMessageToastListener() {
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("new_message_toast")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `recipient_agent_id=eq.${userId}`,
        },
        (payload) => {
          const msg = payload.new as any;
          const snippet = String(msg.body || "").slice(0, 120);
          toast("New message", {
            description: snippet || "You have a new message",
            action: {
              label: "View",
              onClick: () => navigate(`/messages/${msg.conversation_id}`),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, navigate]);

  return null;
}
