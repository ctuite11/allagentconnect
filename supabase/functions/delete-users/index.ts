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

    const emailsToDelete = [
      'chris@directconectmls.com',  // one 'n'
      'chris@directconnectmls.com', // two 'n's
    ];

    console.log("Starting deletion of accounts:", emailsToDelete);

    // First, try to delete directly from auth.users by email (handles orphaned auth entries)
    for (const email of emailsToDelete) {
      // List users to find by email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.log(`Error listing users: ${listError.message}`);
        continue;
      }
      
      const authUser = users?.find(u => u.email === email);
      if (authUser) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);
        if (deleteError) {
          console.log(`Error deleting auth user ${email}: ${deleteError.message}`);
        } else {
          console.log(`Deleted auth user: ${email} (${authUser.id})`);
        }
      } else {
        console.log(`No auth user found for email: ${email}`);
      }
    }

    console.log("Starting deletion of accounts:", emailsToDelete);

    // Get the user IDs from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', emailsToDelete);

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No matching accounts found to delete" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = profiles.map(p => p.id);
    console.log("Found user IDs to delete:", userIds);

    // Delete from all dependent tables in correct order
    const tablesToClean = [
      { table: 'favorites', column: 'user_id' },
      { table: 'hot_sheet_notifications', column: 'user_id' },
      { table: 'hot_sheets', column: 'user_id' },
      { table: 'listing_drafts', column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
      { table: 'agent_settings', column: 'user_id' },
      { table: 'listings', column: 'agent_id' },
      { table: 'agent_state_preferences', column: 'agent_id' },
      { table: 'agent_county_preferences', column: 'agent_id' },
      { table: 'agent_buyer_coverage_areas', column: 'agent_id' },
      { table: 'testimonials', column: 'agent_id' },
      { table: 'email_templates', column: 'agent_id' },
      { table: 'email_campaigns', column: 'agent_id' },
      { table: 'team_members', column: 'agent_id' },
      { table: 'share_tokens', column: 'agent_id' },
      { table: 'client_needs', column: 'submitted_by' },
      { table: 'off_market_views', column: 'viewer_agent_id' },
    ];

    for (const { table, column } of tablesToClean) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in(column, userIds);
      
      if (error) {
        console.log(`Note: Error cleaning ${table}: ${error.message}`);
      } else {
        console.log(`Cleaned table: ${table}`);
      }
    }

    // Handle conversations (has two agent columns)
    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .or(`agent_a_id.in.(${userIds.join(',')}),agent_b_id.in.(${userIds.join(',')})`);
    
    if (convError) {
      console.log(`Note: Error cleaning conversations: ${convError.message}`);
    }

    // Delete from core tables
    const { error: rolesError } = await supabase
      .from('user_roles')
      .delete()
      .in('user_id', userIds);
    
    if (rolesError) {
      console.log(`Note: Error cleaning user_roles: ${rolesError.message}`);
    }

    const { error: agentProfilesError } = await supabase
      .from('agent_profiles')
      .delete()
      .in('id', userIds);
    
    if (agentProfilesError) {
      console.log(`Note: Error cleaning agent_profiles: ${agentProfilesError.message}`);
    }

    const { error: profilesDeleteError } = await supabase
      .from('profiles')
      .delete()
      .in('id', userIds);
    
    if (profilesDeleteError) {
      console.log(`Note: Error cleaning profiles: ${profilesDeleteError.message}`);
    }

    // Delete from auth.users using admin API
    const deletedAuthUsers = [];
    for (const userId of userIds) {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.log(`Note: Error deleting auth user ${userId}: ${authError.message}`);
      } else {
        deletedAuthUsers.push(userId);
        console.log(`Deleted auth user: ${userId}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${deletedAuthUsers.length} accounts`,
      deletedEmails: profiles.map(p => p.email),
      deletedUserIds: deletedAuthUsers
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
