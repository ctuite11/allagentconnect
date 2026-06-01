import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const name = url.searchParams.get("name") || "notify.allagentconnect.com";

  let resp: Response;
  if (action === "create") {
    resp = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ name, region: "us-east-1" }),
    });
  } else if (action === "get") {
    const id = url.searchParams.get("id");
    resp = await fetch(`https://api.resend.com/domains/${id}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
  } else if (action === "verify") {
    const id = url.searchParams.get("id");
    resp = await fetch(`https://api.resend.com/domains/${id}/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
  } else {
    resp = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
  }

  const text = await resp.text();
  return new Response(text, {
    status: resp.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});