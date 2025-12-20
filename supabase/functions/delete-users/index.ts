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
      'chris@directconectmls.com',
      'chris@directconnectmls.com',
    ];

    console.log("Starting deletion of accounts:", emailsToDelete);

    // Get user IDs from agent_profiles (since profiles table may be empty)
    const { data: agentProfiles, error: agentProfilesError } = await supabase
      .from('agent_profiles')
      .select('id, email')
      .in('email', emailsToDelete);

    if (agentProfilesError) {
      console.log(`Error fetching agent_profiles: ${agentProfilesError.message}`);
    }

    const userIds = agentProfiles?.map(p => p.id) || [];
    console.log("Found user IDs from agent_profiles:", userIds);

    // Also check profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', emailsToDelete);

    if (profilesError) {
      console.log(`Error fetching profiles: ${profilesError.message}`);
    }

    const profileUserIds = profiles?.map(p => p.id) || [];
    console.log("Found user IDs from profiles:", profileUserIds);

    // Combine all user IDs
    const allUserIds = [...new Set([...userIds, ...profileUserIds])];
    console.log("All user IDs to delete:", allUserIds);

    // Delete from all dependent tables in correct order
    const tablesToClean = [
      { table: 'listings', column: 'agent_id' },
      { table: 'favorites', column: 'user_id' },
      { table: 'hot_sheet_notifications', column: 'user_id' },
      { table: 'hot_sheets', column: 'user_id' },
      { table: 'listing_drafts', column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
      { table: 'agent_settings', column: 'user_id' },
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
        .in(column, allUserIds);
      
      if (error) {
        console.log(`Note: Error cleaning ${table}: ${error.message}`);
      } else {
        console.log(`Cleaned table: ${table}`);
      }
    }

    // Handle conversations (has two agent columns)
    if (allUserIds.length > 0) {
      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .or(`agent_a_id.in.(${allUserIds.join(',')}),agent_b_id.in.(${allUserIds.join(',')})`);
      
      if (convError) {
        console.log(`Note: Error cleaning conversations: ${convError.message}`);
      }
    }

    // Delete from user_roles
    const { error: rolesError } = await supabase
      .from('user_roles')
      .delete()
      .in('user_id', allUserIds);
    
    if (rolesError) {
      console.log(`Note: Error cleaning user_roles: ${rolesError.message}`);
    } else {
      console.log("Cleaned table: user_roles");
    }

    // Delete from agent_profiles
    const { error: agentProfilesDeleteError } = await supabase
      .from('agent_profiles')
      .delete()
      .in('id', allUserIds);
    
    if (agentProfilesDeleteError) {
      console.log(`Note: Error cleaning agent_profiles: ${agentProfilesDeleteError.message}`);
    } else {
      console.log("Cleaned table: agent_profiles");
    }

    // Delete from profiles
    const { error: profilesDeleteError } = await supabase
      .from('profiles')
      .delete()
      .in('id', allUserIds);
    
    if (profilesDeleteError) {
      console.log(`Note: Error cleaning profiles: ${profilesDeleteError.message}`);
    } else {
      console.log("Cleaned table: profiles");
    }

    // Now delete from auth.users using admin API
    const deletedAuthUsers = [];
    for (const userId of allUserIds) {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.log(`Note: Error deleting auth user ${userId}: ${authError.message}`);
      } else {
        deletedAuthUsers.push(userId);
        console.log(`Deleted auth user: ${userId}`);
      }
    }

    // Also try to find and delete by email directly from auth.users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (!listError && users) {
      for (const email of emailsToDelete) {
        const authUser = users.find(u => u.email === email);
        if (authUser && !deletedAuthUsers.includes(authUser.id)) {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);
          if (deleteError) {
            console.log(`Error deleting auth user ${email}: ${deleteError.message}`);
          } else {
            deletedAuthUsers.push(authUser.id);
            console.log(`Deleted auth user by email: ${email} (${authUser.id})`);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${deletedAuthUsers.length} accounts`,
      deletedUserIds: deletedAuthUsers,
      cleanedUserIds: allUserIds
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
