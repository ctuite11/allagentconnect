import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the request body - support both userIds and emails
    const { userIds: providedUserIds, emails } = await req.json();
    
    const userIds: string[] = providedUserIds || [];

    // If emails provided, look up user IDs with PAGINATION
    if (emails && Array.isArray(emails) && emails.length > 0) {
      console.log("Looking up user IDs for emails:", emails);
      
      const emailsToFind = new Set(emails.map((e: string) => e.toLowerCase()));
      let page = 1;
      const perPage = 50;
      let hasMore = true;
      
      while (hasMore && emailsToFind.size > 0) {
        console.log(`Fetching auth users page ${page}...`);
        
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
          page,
          perPage
        });
        
        if (listError) {
          console.error(`Error listing users on page ${page}:`, listError);
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to list users: ${listError.message}`
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log(`Page ${page}: found ${usersData.users.length} users`);
        
        // Check each user on this page
        for (const user of usersData.users) {
          const userEmail = user.email?.toLowerCase();
          if (userEmail && emailsToFind.has(userEmail)) {
            console.log(`Found user ID ${user.id} for email ${user.email} on page ${page}`);
            userIds.push(user.id);
            emailsToFind.delete(userEmail);
          }
        }
        
        // Check if there are more pages
        hasMore = usersData.users.length === perPage;
        page++;
      }
      
      console.log(`Searched ${page - 1} pages total. Found ${userIds.length} users.`);
      
      // Log any emails not found
      if (emailsToFind.size > 0) {
        console.log("Emails not found:", Array.from(emailsToFind));
      }
      
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "No valid userIds or emails provided"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Starting deletion of user IDs:", userIds);

    const deletedAuthUsers = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        // Delete the auth user
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        
        if (authError) {
          console.log(`Error deleting auth user ${userId}: ${authError.message}`);
          errors.push({ userId, error: authError.message });
        } else {
          deletedAuthUsers.push(userId);
          console.log(`Successfully deleted auth user: ${userId}`);
        }
      } catch (err: any) {
        console.log(`Exception deleting auth user ${userId}: ${err.message}`);
        errors.push({ userId, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${deletedAuthUsers.length} of ${userIds.length} auth accounts`,
      deletedUserIds: deletedAuthUsers,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in delete-users function:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
