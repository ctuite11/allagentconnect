/// <reference types="node" />

type Handler = (event: {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}) => Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}>;
import { createClient } from "@supabase/supabase-js";

import { buildCorsHeaders } from "./repliers-utils";

type SyncPayload = {
  agentId: string;
  sourceListingId?: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType?: string | null;
  price: number | string;
  beds?: number | string | null;
  baths?: number | string | null;
  sqft?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  photos?: unknown[] | null;
  attomId?: string | number | null;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const cleanZip = (zip: string) => {
  const digits = String(zip || "").replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : digits;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractUnitInfo = (rawAddress: string): { street: string; unitNumber: string | null } => {
  const address = normalizeWhitespace(rawAddress);

  // Remove common trailing unit fragments to normalize street-level matching.
  const match = address.match(/^(.*?)(?:,?\s+)(?:apt|apartment|unit|#|suite|ste|fl|floor)\s*([A-Za-z0-9-]+)$/i);
  if (!match) {
    return { street: address, unitNumber: null };
  }

  return {
    street: normalizeWhitespace(match[1]),
    unitNumber: normalizeWhitespace(match[2]),
  };
};

const normalizePhotos = (photos: unknown[] | null | undefined): unknown[] => {
  if (!Array.isArray(photos)) return [];
  return photos.filter(Boolean).slice(0, 60);
};

const resolveStatus = () => "active";

const parsePayload = (eventBody: string | null): SyncPayload => {
  if (!eventBody) {
    throw new Error("Missing request body");
  }

  const parsed = JSON.parse(eventBody) as SyncPayload;
  if (!parsed?.agentId) throw new Error("agentId is required");
  if (!parsed?.address) throw new Error("address is required");
  if (!parsed?.city) throw new Error("city is required");
  if (!parsed?.state) throw new Error("state is required");
  if (!parsed?.zip) throw new Error("zip is required");

  const price = toNumberOrNull(parsed.price);
  if (!price || price <= 0) throw new Error("price must be a positive number");

  return parsed;
};

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const cors = buildCorsHeaders(origin, "POST, OPTIONS");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...cors.headers,
  };

  if (cors.isBrowserRequest && !cors.isAllowedOrigin) {
    return { statusCode: 403, headers, body: "" };
  }

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  const syncToken = process.env.AAC_SYNC_TOKEN;
  if (!syncToken || event.headers["x-aac-sync-token"] !== syncToken) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, error: "Unauthorized" }),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRole) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Missing Supabase service credentials",
      }),
    };
  }

  try {
    const payload = parsePayload(event.body);
    const { street, unitNumber } = extractUnitInfo(payload.address);

    const city = toTitleCase(normalizeWhitespace(payload.city));
    const state = normalizeWhitespace(payload.state).toUpperCase();
    const zipCode = cleanZip(payload.zip);
    const addressNormalized = normalizeWhitespace(street).toLowerCase();

    const price = toNumberOrNull(payload.price)!;
    const bedrooms = toNumberOrNull(payload.beds);
    const bathrooms = toNumberOrNull(payload.baths);
    const squareFeet = toNumberOrNull(payload.sqft);
    const latitude = toNumberOrNull(payload.lat);
    const longitude = toNumberOrNull(payload.lng);
    const photos = normalizePhotos(payload.photos);

    const listingPatch = {
      agent_id: payload.agentId,
      address: street,
      address_normalized: addressNormalized,
      unit_number: unitNumber,
      city,
      state,
      zip_code: zipCode,
      property_type: payload.propertyType ? String(payload.propertyType) : "single_family",
      price,
      bedrooms,
      bathrooms,
      square_feet: squareFeet,
      latitude,
      longitude,
      photos,
      attom_id: payload.attomId ? String(payload.attomId) : null,
      status: resolveStatus(),
      listing_type: "for_sale",
    };

    const supabase = createClient(supabaseUrl, serviceRole);

    const { data: existing, error: existingError } = await supabase
      .from("listings")
      .select("id")
      .eq("agent_id", payload.agentId)
      .eq("address_normalized", addressNormalized)
      .eq("city", city)
      .eq("state", state)
      .eq("zip_code", zipCode)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("listings")
        .update(listingPatch)
        .eq("id", existing.id);

      if (updateError) {
        throw updateError;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          action: "updated",
          listingId: existing.id,
          normalized: {
            address: street,
            city,
            state,
            zip: zipCode,
            unitNumber,
          },
        }),
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("listings")
      .insert(listingPatch)
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        action: "created",
        listingId: inserted.id,
        normalized: {
          address: street,
          city,
          state,
          zip: zipCode,
          unitNumber,
        },
      }),
    };
  } catch (error: any) {
    console.error("[aac-sync-listing] Error:", error?.message || error);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: error?.message || "Sync failed" }),
    };
  }
};
