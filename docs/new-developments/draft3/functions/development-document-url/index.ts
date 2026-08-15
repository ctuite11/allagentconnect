// @auth-classification: user-jwt
/**
 * development-document-url (DRAFT 3 — NOT DEPLOYED).
 *
 * Mints a 5-minute signed URL for a private development document.
 * Review item 4: the object path is re-verified against the row's
 * development_id in code before signing, independently of the DB CHECK
 * constraint, so a row pointing at another development's object can never
 * be signed even if the constraint were dropped.
 *
 * Path A (agent):  eligible agent + published development + active account (G1)
 * Path B (member): accepted member of the owning account, any publish_status,
 *                  active or not (recovery/preview, by design)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BUCKET = "development-documents";
const SIGNED_URL_TTL_SECONDS = 300;

const BodySchema = z.object({ document_id: z.string().uuid() });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await anonClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.id) return json({ error: "Unauthorized" }, 401);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: document, error: documentError } = await admin
    .from("development_documents")
    .select("id, development_id, account_id, storage_path, developments!inner(publish_status, development_accounts!inner(is_active))")
    .eq("id", parsed.data.document_id)
    .maybeSingle();

  if (documentError) {
    console.error("[development-document-url] lookup failed:", documentError.message);
    return json({ error: "Unable to load this document" }, 500);
  }
  if (!document) return json({ error: "Not found" }, 404);

  // Review item 4 — independent path/row binding check BEFORE any authorization
  // decision is acted on. First path segment must equal the row's development_id.
  const firstSegment = String(document.storage_path ?? "").split("/")[0];
  if (!firstSegment || firstSegment !== String(document.development_id)) {
    console.error(
      "[development-document-url] path/development mismatch for document",
      document.id,
    );
    return json({ error: "Forbidden" }, 403);
  }

  const publishStatus = (document as any).developments?.publish_status;
  const accountActive = (document as any).developments?.development_accounts?.is_active === true;

  const [{ data: isAdmin }, { data: isEligible }, { data: isMember }] = await Promise.all([
    admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    admin.rpc("is_eligible_agent", { _user_id: user.id }),
    admin
      .from("development_account_members")
      .select("id")
      .eq("account_id", document.account_id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then((r: any) => ({ data: Boolean(r.data) })),
  ]);

  const agentPath = isEligible === true && publishStatus === "published" && accountActive;
  const memberPath = isMember === true;

  if (!(agentPath || memberPath || isAdmin === true)) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error("[development-document-url] signing failed:", signError?.message);
    return json({ error: "Unable to generate a download link" }, 500);
  }

  return json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
});
