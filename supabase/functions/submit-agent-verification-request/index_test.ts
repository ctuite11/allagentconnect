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

Deno.test("Invalid JSON returns 400", async () => {
  const res = await handleRequest(
    new Request("http://x/", { method: "POST", body: "not json" }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Invalid JSON body");
});

Deno.test("Missing email returns 400 invalid_email", async () => {
  const res = await handleRequest(
    new Request("http://x/", {
      method: "POST",
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "invalid_email");
});

Deno.test("Placeholder license fails validation", async () => {
  const res = await handleRequest(
    new Request("http://x/", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        licenseState: "NJ",
        licenseNumber: "test",
        turnstileToken: "any",
      }),
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "validation_failed");
});

Deno.test("Disposable email fails validation", async () => {
  const res = await handleRequest(
    new Request("http://x/", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@mailinator.com",
        licenseState: "NJ",
        licenseNumber: "1234567",
        turnstileToken: "any",
      }),
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "validation_failed");
});