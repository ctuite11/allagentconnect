import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Verify the JWT with Auth, then evaluate the database's actual network gate. */
export async function verifiedPrivacyClient(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const { data: allowed, error: gateError } = await client.rpc("privacy_network_access");
  if (gateError || allowed !== true) return null;
  const { data: owner, error: ownerError } = await client.rpc("current_account_owner_id");
  if (ownerError) return null;
  return { client, userId: data.user.id, ownerId: owner || data.user.id };
}
