import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Known FK tables that block auth.users deletion
const BLOCKER_CHECKS = [
  { table: 'profiles', column: 'id' },
  { table: 'user_roles', column: 'user_id' },
  { table: 'favorites', column: 'user_id' },
  { table: 'buyer_qualifications', column: 'user_id' },
  { table: 'buyer_credentials', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'client_agent_relationships', column: 'client_id' },
  { table: 'conversation_participants', column: 'user_id' },
  { table: 'hot_sheet_comments', column: 'sender_id' },
] as const;

// FK columns that can be SET NULL safely (don't block, just need cleanup)
const NULLABLE_FK_CHECKS = [
  { table: 'share_tokens', column: 'accepted_by_user_id' },
  { table: 'listing_status_history', column: 'changed_by' },
] as const;

async function detectBlockers(supabase: any, userId: string) {
  const blockers: Record<string, number> = {};

  // Check hard FK blockers
  for (const { table, column } of BLOCKER_CHECKS) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, userId);
    if (!error && count && count > 0) {
      blockers[`${table}.${column}`] = count;
    }
  }

  // Check nullable FK references
  for (const { table, column } of NULLABLE_FK_CHECKS) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, userId);
    if (!error && count && count > 0) {
      blockers[`${table}.${column}`] = count;
    }
  }

  return blockers;
}

async function clearBlockers(supabase: any, userId: string) {
  const cleared: string[] = [];

  // SET NULL on nullable FK columns
  for (const { table, column } of NULLABLE_FK_CHECKS) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);
    if (!error) cleared.push(`${table}.${column}`);
  }

  // Delete from hard FK tables (order matters for cascading)
  for (const { table, column } of BLOCKER_CHECKS) {
    if (table === 'profiles') continue; // Delete last
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(column, userId);
    if (!error) cleared.push(table);
  }

  // Delete profile last
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (!error) cleared.push('profiles');

  return cleared;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userIds: providedUserIds, emails, dryRun } = await req.json();
    const userIds: string[] = providedUserIds || [];

    // If emails provided, look up user IDs with pagination
    if (emails && Array.isArray(emails) && emails.length > 0) {
      console.log("Looking up user IDs for emails:", emails);
      const emailsToFind = new Set(emails.map((e: string) => e.toLowerCase()));
      let page = 1;
      const perPage = 50;
      let hasMore = true;

      while (hasMore && emailsToFind.size > 0) {
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
        if (listError) {
          return new Response(JSON.stringify({
            success: false, deleted: 0,
            error: `Failed to list users: ${listError.message}`
          }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        for (const user of usersData.users) {
          const userEmail = user.email?.toLowerCase();
          if (userEmail && emailsToFind.has(userEmail)) {
            userIds.push(user.id);
            emailsToFind.delete(userEmail);
          }
        }
        hasMore = usersData.users.length === perPage;
        page++;
      }

      if (emailsToFind.size > 0) {
        console.log("Emails not found in auth:", Array.from(emailsToFind));
      }
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({
        success: false, deleted: 0,
        error: "No valid userIds or emails provided"
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DRY RUN: detect blockers only, don't delete anything
    if (dryRun) {
      console.log("Dry run — detecting blockers for:", userIds);
      const allBlockers: Record<string, Record<string, number>> = {};
      for (const userId of userIds) {
        const blockers = await detectBlockers(supabase, userId);
        if (Object.keys(blockers).length > 0) {
          allBlockers[userId] = blockers;
        }
      }
      return new Response(JSON.stringify({
        success: true, dryRun: true,
        userIds,
        blockers: allBlockers,
        message: Object.keys(allBlockers).length > 0
          ? `${Object.keys(allBlockers).length} user(s) have FK blockers`
          : "No blockers detected — safe to delete"
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // REAL DELETION
    console.log("Starting deletion of user IDs:", userIds);
    const deletedAuthUsers: string[] = [];
    const errors: Array<{ userId: string; error: string; blockers?: Record<string, number> }> = [];

    for (const userId of userIds) {
      try {
        // Step 1: Clear FK blockers before attempting auth deletion
        const blockersBefore = await detectBlockers(supabase, userId);
        if (Object.keys(blockersBefore).length > 0) {
          console.log(`User ${userId} has blockers:`, blockersBefore);
          const cleared = await clearBlockers(supabase, userId);
          console.log(`Cleared blockers for ${userId}:`, cleared);
        }

        // Step 2: Delete auth user
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) {
          // Re-detect remaining blockers for diagnostic
          const remainingBlockers = await detectBlockers(supabase, userId);
          console.log(`Error deleting auth user ${userId}: ${authError.message}`, remainingBlockers);
          errors.push({
            userId,
            error: authError.message,
            blockers: Object.keys(remainingBlockers).length > 0 ? remainingBlockers : undefined,
          });
        } else {
          deletedAuthUsers.push(userId);
          console.log(`Successfully deleted auth user: ${userId}`);
        }
      } catch (err: any) {
        console.log(`Exception deleting auth user ${userId}: ${err.message}`);
        errors.push({ userId, error: err.message });
      }
    }

    const allSucceeded = deletedAuthUsers.length === userIds.length;
    return new Response(JSON.stringify({
      success: allSucceeded,
      deleted: deletedAuthUsers.length,
      message: `Deleted ${deletedAuthUsers.length} of ${userIds.length} auth accounts`,
      deletedUserIds: deletedAuthUsers,
      errors: errors.length > 0 ? errors : undefined,
      error: !allSucceeded ? `Failed to delete ${errors.length} of ${userIds.length} auth accounts` : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("Error in delete-users function:", error);
    return new Response(JSON.stringify({
      success: false, deleted: 0, error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
