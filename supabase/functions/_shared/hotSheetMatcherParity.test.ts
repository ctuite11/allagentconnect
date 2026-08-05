import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION = new URL(
  "../../migrations/20260805070000_hot_sheet_reopening_dispatchers_and_matcher_parity.sql",
  import.meta.url,
);

async function sql(): Promise<string> {
  return await Deno.readTextFile(MIGRATION);
}

function matcherBody(src: string): string {
  const start = src.indexOf("CREATE OR REPLACE FUNCTION public.check_hot_sheet_matches");
  assertEquals(start > 0, true);
  return src.slice(start);
}

Deno.test("matcher enforces every HotSheetCriteriaCore field that has a column", async () => {
  const body = matcherBody(await sql());
  const expected = [
    "'state'",
    "'selectedCountyId'",
    "'cities'",
    "'showAreas'",
    "'propertyTypes'",
    "'statuses'",
    "'minPrice'",
    "'maxPrice'",
    "'hasNoMin'",
    "'hasNoMax'",
    "'bedrooms'",
    "'bathrooms'",
    "'acres'",
    "'minSqft'",
    "'maxSqft'",
    "'pricePerSqft'",
    "'hasParking'",
  ];
  for (const key of expected) assertStringIncludes(body, key);
});

Deno.test("matcher filters on the mapped listing columns", async () => {
  const body = matcherBody(await sql());
  for (
    const clause of [
      "upper(l.state)",
      "lower(l.county)",
      "lower(l.city)",
      "l.neighborhood",
      "l.property_type::text = ANY(v_property_types)",
      "l.price >= v_min_price",
      "l.price <= v_max_price",
      "l.bedrooms >= v_bedrooms",
      "l.bathrooms >= v_bathrooms",
      "l.lot_size >= v_acres",
      "l.square_feet >= v_min_sqft",
      "l.square_feet <= v_max_sqft",
      "l.price / l.square_feet <= v_price_per_sqft",
      "l.garage_spaces",
      "l.total_parking_spaces",
    ]
  ) {
    assertStringIncludes(body, clause);
  }
});

Deno.test("rooms is documented as unsupported, not silently dropped", async () => {
  const src = await sql();
  assertStringIncludes(src, "NOT enforced — `rooms`");
  // rooms is read only to fail closed — it must never appear in the SELECT filter.
  const body = matcherBody(src);
  assertEquals(body.slice(body.indexOf("RETURN QUERY")).includes("'rooms'"), false);
});

Deno.test("hasParking supports yes / no / any", async () => {
  const body = matcherBody(await sql());
  assertStringIncludes(body, "v_has_parking IS NULL");
  assertStringIncludes(body, "v_has_parking = true");
  assertStringIncludes(body, "v_has_parking = false");
});

Deno.test("dispatchers are revoked from PUBLIC/anon/authenticated and granted only to service_role", async () => {
  const src = await sql();
  for (const fn of ["public.invoke_process_email_queue()", "public.dispatch_hot_sheet_listing(uuid)"]) {
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      assertStringIncludes(src, `REVOKE ALL ON FUNCTION ${fn} FROM ${role};`);
    }
    assertStringIncludes(src, `GRANT EXECUTE ON FUNCTION ${fn} TO service_role;`);
  }
});

Deno.test("listing-event dispatcher verifies the listing row exists first", async () => {
  const src = await sql();
  const start = src.indexOf("CREATE OR REPLACE FUNCTION public.dispatch_hot_sheet_listing");
  const body = src.slice(start, src.indexOf("$fn$;", start));
  assertStringIncludes(body, "IF NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.id = p_listing_id)");
});

Deno.test("trigger dispatches on any match-relevant column change, not status alone", async () => {
  const src = await sql();
  const start = src.indexOf("CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing");
  const body = src.slice(start, src.indexOf("$fn$;", start));
  for (
    const col of [
      "status", "state", "county", "city", "neighborhood", "property_type", "price",
      "bedrooms", "bathrooms", "lot_size", "square_feet",
      "parking_spaces", "garage_spaces", "total_parking_spaces", "agent_id",
    ]
  ) {
    assertStringIncludes(body, `OLD.${col}`);
    assertStringIncludes(body, `NEW.${col}`);
  }
  assertStringIncludes(src, "AFTER INSERT OR UPDATE OF");
  // Legacy spelling must be dispatchable too.
  assertStringIncludes(body, "'cancelled'");
});

Deno.test("matcher fails closed on empty strings, non-array lists, unknown county, unknown parking", async () => {
  const body = matcherBody(await sql());
  assertStringIncludes(body, "NULLIF(trim(");
  assertStringIncludes(body, "jsonb_typeof(v_criteria->'statuses') = 'array'");
  assertStringIncludes(body, "jsonb_typeof(v_criteria->'cities') = 'array'");
  assertStringIncludes(body, "jsonb_typeof(v_criteria->'propertyTypes') = 'array'");
  assertStringIncludes(body, "returning zero matches");
  assertStringIncludes(body, "l.parking_spaces IS NOT NULL");
});

Deno.test("rooms fails closed rather than being ignored", async () => {
  const body = matcherBody(await sql());
  assertStringIncludes(body, "v_rooms := NULLIF(trim(COALESCE(v_criteria->>'rooms', '')), '');");
  assertStringIncludes(body, "IF v_rooms IS NOT NULL THEN");
});

Deno.test("matcher keeps per-status sent-state dedupe", async () => {
  const body = matcherBody(await sql());
  assertStringIncludes(body, "hot_sheet_sent_listings");
  assertStringIncludes(body, "hssl.status_at_send = l.status::text");
});

Deno.test("dispatchers send exact service-role Authorization and apikey from Vault", async () => {
  const src = await sql();
  for (
    const fn of [
      "CREATE OR REPLACE FUNCTION public.invoke_process_email_queue",
      "CREATE OR REPLACE FUNCTION public.dispatch_hot_sheet_listing",
    ]
  ) {
    const start = src.indexOf(fn);
    assertEquals(start > 0, true);
    const body = src.slice(start, src.indexOf("$fn$;", start));
    assertStringIncludes(body, "vault.decrypted_secrets");
    assertStringIncludes(body, "'email_dispatch_service_role_key'");
    assertStringIncludes(body, "'Authorization', 'Bearer ' || v_key");
    assertStringIncludes(body, "'apikey', v_key");
    // Fail closed when the secret is absent.
    assertStringIncludes(body, "RETURN");
  }
  assertStringIncludes(src, "'listing_id', p_listing_id::text");
});

Deno.test("trigger covers the full Hot Sheet status set, including the legacy cancelled spelling", async () => {
  const src = await sql();
  const start = src.indexOf("CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing");
  const body = src.slice(start, src.indexOf("$fn$;", start));
  for (
    const status of [
      "active",
      "price_changed",
      "back_on_market",
      "off_market",
      "extended",
      "reactivated",
      "contingent",
      "under_agreement",
      "sold",
      "rented",
      "temporarily_withdrawn",
      "expired",
      "canceled",
      "coming_soon",
    ]
  ) {
    assertStringIncludes(body, `'${status}'`);
  }
  assertStringIncludes(body, "OLD.status               IS DISTINCT FROM NEW.status");
  assertStringIncludes(body, "public.dispatch_hot_sheet_listing(NEW.id)");
});

Deno.test("isolation preserved: no Communications fan-out, no retired broadcast", async () => {
  const src = await sql();
  assertEquals(src.includes("notify-agents-new-listing"), false);
  assertEquals(src.includes("process-comms-digests"), false);
  assertEquals(src.includes("send-client-need-notification"), false);
  assertEquals(src.includes("client_needs"), false);
  // Nothing is unpaused or enqueued by the migration.
  assertEquals(/insert\s+into\s+public\.email_jobs/i.test(src), false);
  // cron.alter_job is used, but only to rewrite the worker command — never to
  // activate a job, and never via a direct UPDATE on cron.job.
  assertEquals(/cron\.alter_job\([^)]*active/is.test(src), false);
  assertEquals(/UPDATE\s+cron\.job/i.test(src), false);
});

Deno.test("obsolete anon matcher cron is unscheduled; worker cron keeps its state", async () => {
  const src = await sql();
  // The obsolete matcher cron row is RETAINED (inactive) for audit history.
  assertEquals(src.includes("cron.unschedule("), false);
  assertStringIncludes(src, "cron.alter_job(");
  assertEquals(/UPDATE\s+cron\.job/i.test(src), false);
  assertStringIncludes(src, "SELECT public.invoke_process_email_queue();");
});
