import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./index.ts";

Deno.test("OPTIONS returns CORS ok", async () => {
  const res = await handleRequest(new Request("http://x/", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("GET returns 405", async () => {
  const res = await handleRequest(new Request("http://x/", { method: "GET" }));
  assertEquals(res.status, 405);
  await res.text();
});

Deno.test("Missing Authorization returns 401", async () => {
  const res = await handleRequest(
    new Request("http://x/", {
      method: "POST",
      body: JSON.stringify({ pendingVerificationId: "00000000-0000-0000-0000-000000000000" }),
    }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Authorization required");
});

// Full auth/session paths require live Supabase env vars and are exercised
// via manual invocation once the admin UI is wired in Phase 2/3.