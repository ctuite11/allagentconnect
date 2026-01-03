import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  licenseState: string;
  licenseNumber: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header to verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("[admin-create-user] No authorization header");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to check their role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      console.error("[admin-create-user] Failed to get calling user:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[admin-create-user] Caller:", callingUser.email, callingUser.id);

    // Verify the caller is an admin using has_role RPC
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: callingUser.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("[admin-create-user] Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isAdmin !== true) {
      console.error("[admin-create-user] Caller is not admin:", callingUser.email);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[admin-create-user] Admin verified, proceeding with user creation");

    // Parse the request body
    const body: CreateUserRequest = await req.json();
    const { email, password, firstName, lastName, phone, licenseState, licenseNumber } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !licenseState || !licenseNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create the user using admin API (does NOT sign in the new user)
    console.log("[admin-create-user] Creating auth user for:", email);
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        intended_role: "agent",
        created_by_admin: true,
      },
    });

    if (authError) {
      console.error("[admin-create-user] Auth creation error:", authError);
      
      // Check for duplicate user
      if (authError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "This email is already registered" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.error("[admin-create-user] No user ID returned");
      return new Response(
        JSON.stringify({ error: "Failed to create user account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[admin-create-user] Auth user created:", userId);

    // Create agent_profiles record
    const { error: profileError } = await adminClient
      .from("agent_profiles")
      .insert({
        id: userId,
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim() || null,
      });

    if (profileError) {
      console.error("[admin-create-user] Profile creation error:", profileError);
      // User was created but profile failed - still return success with warning
    } else {
      console.log("[admin-create-user] Agent profile created");
    }

    // Update agent_settings with license info (row created by handle_new_user trigger)
    const { error: settingsError } = await adminClient
      .from("agent_settings")
      .update({
        license_state: licenseState,
        license_number: licenseNumber.trim(),
        license_last_name: lastName.trim(),
        agent_status: "pending", // Set to pending for admin review
      })
      .eq("user_id", userId);

    if (settingsError) {
      console.error("[admin-create-user] Settings update error:", settingsError);
      // Try insert if update failed (trigger might not have run)
      const { error: insertError } = await adminClient
        .from("agent_settings")
        .insert({
          user_id: userId,
          license_state: licenseState,
          license_number: licenseNumber.trim(),
          license_last_name: lastName.trim(),
          agent_status: "pending",
        });
      
      if (insertError) {
        console.error("[admin-create-user] Settings insert error:", insertError);
      }
    } else {
      console.log("[admin-create-user] Agent settings updated");
    }

    // Assign agent role
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "agent",
      });

    if (roleInsertError && !roleInsertError.message?.includes("duplicate")) {
      console.error("[admin-create-user] Role assignment error:", roleInsertError);
    } else {
      console.log("[admin-create-user] Agent role assigned");
    }

    console.log("[admin-create-user] SUCCESS - User created:", email);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email,
        message: "Agent created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[admin-create-user] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
