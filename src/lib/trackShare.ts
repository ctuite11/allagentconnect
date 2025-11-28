import { supabase } from "@/integrations/supabase/client";

export const trackShare = async (
  listingId: string,
  shareType: 'copy_link' | 'native' | 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'email' | 'email_direct' | 'email_bulk',
  recipientEmail?: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("listing_shares").insert({
      listing_id: listingId,
      shared_by: user?.id || null,
      share_type: shareType,
      recipient_email: recipientEmail || null
    });
  } catch (error) {
    console.error("Error tracking share:", error);
  }
};
