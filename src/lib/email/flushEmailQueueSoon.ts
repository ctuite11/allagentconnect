import { supabase } from "@/integrations/supabase/client";

export async function flushEmailQueueSoon() {
  try {
    const { error } = await supabase.functions.invoke("kick-email-queue");

    if (error) {
      console.error("kick-email-queue invoke failed", error);
    }
  } catch (err) {
    console.error("kick-email-queue unexpected error", err);
  }
}
