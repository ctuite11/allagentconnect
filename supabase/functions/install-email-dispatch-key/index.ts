// TEMPORARY one-shot operator function: copies the project's service-role key
// into the Vault secret 'email_dispatch_service_role_key'. It never returns or
// logs the decrypted value. Delete after use.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "service_role_required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("mode") === "verify") {
    const pg = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data, error } = await pg.rpc("probe_email_dispatch_secret");
    return new Response(JSON.stringify({ probe: data, error: error?.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data, error } = await supabase.rpc(
    "install_email_dispatch_service_role_key",
    { p_key: serviceKey },
  );

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, outcome: data }), {
    headers: { "Content-Type": "application/json" },
  });
});
