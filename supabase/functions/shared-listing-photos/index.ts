import "../_shared/migrationRuntime.ts";
// @auth-classification: token-redemption
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { privateStorageObject, PRIVATE_MEDIA_TTL } from "../_shared/privateListingMedia.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const text = await req.text();
    if (text.length > 4096) return json({ error: "invalid_link" }, 400);
    const body = JSON.parse(text);
    if (!uuid.test(body.listing_id ?? "") ||
      (body.token != null && (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 200)) ||
      (body.hot_sheet_id != null && !uuid.test(body.hot_sheet_id)) ||
      (body.dcmls != null && typeof body.dcmls !== "boolean") ||
      (body.dcmls === true && (body.token != null || body.hot_sheet_id != null))) return json({ error: "invalid_link" }, 400);
    const base = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    let caller = admin;
    if (!body.token && !body.dcmls) {
      const authorization = req.headers.get("Authorization") ?? "";
      caller = createClient(base, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
      });
      const { data, error } = await caller.auth.getUser();
      if (error || !data.user) return json({ error: "invalid_link" }, 404);
    }
    const { data: paths, error } = body.dcmls === true
      ? await admin.rpc("get_dcmls_listing_photo_paths", { p_listing_id: body.listing_id })
      : await caller.rpc("get_shared_listing_photo_paths", {
      p_token: body.token ?? null, p_listing_id: body.listing_id, p_hot_sheet_id: body.hot_sheet_id ?? null,
    });
    if (error || !paths) return json({ error: "invalid_link" }, 404);
    const result: Record<string, (string | null)[]> = {};
    for (const [field, bucket] of [["photos", "listing-photos"], ["floor_plans", "listing-floorplans"]]) {
      const stored = Array.isArray(paths[field]) ? paths[field].slice(0, 60) : [];
      // Preserve indexes: a missing object must not shift another photo's slot.
      result[field] = stored.map(() => null);
      const objects = stored.map((value: unknown, index: number) => ({ index, object: privateStorageObject(value, bucket, base) }))
        .filter((entry: { index: number; object: { bucket: string; path: string } | null }): entry is { index: number; object: { bucket: string; path: string } } =>
          entry.object !== null && entry.object.bucket === bucket);
      if (objects.length) {
        const { data: signed, error: signingError } = await admin.storage.from(bucket)
          .createSignedUrls(objects.map((entry: { object: { path: string } }) => entry.object.path), PRIVATE_MEDIA_TTL);
        if (!signingError) objects.forEach((entry: { index: number }, index: number) => {
          result[field][entry.index] = signed?.[index]?.signedUrl ?? null;
        });
      }
    }
    return json({ ...result, expires_in: PRIVATE_MEDIA_TTL });
  } catch {
    return json({ error: "invalid_link" }, 404);
  }
});
