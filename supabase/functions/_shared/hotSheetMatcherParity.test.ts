import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION = new URL(
  "../../migrations/20260805064500_hot_sheet_reopening_dispatchers_and_matcher_parity.sql",
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
  // rooms must not appear as a criteria lookup that pretends to filter.
  assertEquals(matcherBody(src).includes("->>'rooms'"), false);
});

Deno.test("hasParking supports yes / no / any", async () => {
  const body = matcherBody(await sql());
  assertStringIncludes(body, "v_has_parking IS NULL");
  assertStringIncludes(body, "v_has_parking = true");
  assertStringIncludes(body, "v_has_parking = false");
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
    const body = src.slice(start, src.indexOf("$$;", start));
    assertStringIncludes(body, "vault.decrypted_secrets");
    assertStringIncludes(body, "'service_role_key'");
    assertStringIncludes(body, "'Authorization', 'Bearer ' || v_key");
    assertStringIncludes(body, "'apikey', v_key");
    // Fail closed when the secret is absent.
    assertStringIncludes(body, "RETURN");
  }
  assertStringIncludes(src, "'listing_id', p_listing_id::text");
});

Deno.test("trigger covers the full Hot Sheet status set and only status changes", async () => {
  const src = await sql();
  const start = src.indexOf("CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing");
  const body = src.slice(start, src.indexOf("$$;", start));
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
  assertStringIncludes(body, "OLD.status IS NOT DISTINCT FROM NEW.status");
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
  assertEquals(/cron\.alter_job/i.test(src), false);
  assertEquals(/UPDATE\s+cron\.job\s+SET\s+active/i.test(src), false);
});

Deno.test("obsolete anon matcher cron is unscheduled; worker cron keeps its state", async () => {
  const src = await sql();
  assertStringIncludes(src, "cron.unschedule('send-new-match-notification-every-15-min')");
  assertStringIncludes(src, "SELECT public.invoke_process_email_queue();");
});
