import "../_shared/migrationRuntime.ts";
// @auth-classification: public-read
import { PRIVATE_PREVIEW_HTML, PRIVATE_PREVIEW_HEADERS } from "../_shared/privatePreview.ts";

Deno.serve(req => new Response(req.method === "OPTIONS" ? null : PRIVATE_PREVIEW_HTML, {
  headers: { ...PRIVATE_PREVIEW_HEADERS, "Access-Control-Allow-Origin": "*" },
}));
