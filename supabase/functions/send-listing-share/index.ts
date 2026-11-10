import "../_shared/migrationRuntime.ts";
import { verifiedPrivacyClient } from "../_shared/privacyAuth.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { buildAgentSharedPropertyEmailSubject } from "../_shared/listingEmailSubject.ts";
import { renderEmailTemplate } from "../_shared/renderEmailTemplate.ts";
import { buildTransactionalFrom } from "../_shared/transactionalSender.ts";
import { formatListingShareEmailFullAddress } from "../_shared/listingShareEmailAddress.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { assertMigrationDeliveryAllowed } from "../_shared/migrationSafety.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShareListingRequest {
  listingId: string;
  recipientEmail: string;
  recipientName: string;
  agentName: string;
  agentEmail: string;
  agentPhone?: string;
  agentBrokerage?: string;
  message?: string;
  senderRole?: 'agent' | 'buyer';
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function humanize(value: unknown): string {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatPrice(price: unknown): string {
  const num = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(num) || num <= 0) return "Price upon request";
  return `$${Math.round(num).toLocaleString()}`;
}

function formatPropertyType(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.includes("_") ? humanize(raw) : raw.split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function listingIdLabel(listing: Record<string, unknown>): string {
  const listingNumber = listing.listing_number || listing.mls_number;
  if (listingNumber) return `#${String(listingNumber).trim()}`;
  if (listing.id) return `#${String(listing.id).slice(0, 8).toUpperCase()}`;
  return "";
}

function buildListingShareText(opts: {
  recipientName: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  listingUrl: string;
  listing: Record<string, unknown>;
}): string {
  const { recipientName, agentName, agentEmail, agentPhone, listingUrl, listing } = opts;
  const firstName = String(recipientName || "there").trim().split(/\s+/)[0] || "there";
  const status = humanize(listing.status);
  const neighborhood = String(listing.neighborhood ?? "").trim();
  const idLabel = listingIdLabel(listing);
  const propertyType = formatPropertyType(listing.property_type);
  const address = formatListingShareEmailFullAddress(listing as any);
  const sqft = listing.square_feet ?? listing.squareFeet;
  const stats = [
    listing.bedrooms != null ? `◆ ${listing.bedrooms} bd` : "",
    listing.bathrooms != null ? `◆ ${listing.bathrooms} ba` : "",
    sqft ? `◆ ${Number(sqft).toLocaleString()} sqft` : "",
  ].filter(Boolean).join(" · ");

  return [
    `${agentName} shared a property with you`,
    "",
    "All Agent Connect",
    "",
    "A Property Has Been Shared With You",
    "",
    `Hi ${firstName},`,
    "",
    `${agentName} wants to share a property with you that may interest you:`,
    "",
    status ? `${status} ` : "",
    "",
    listingUrl,
    "",
    neighborhood ? `${neighborhood} ` : "",
    "",
    formatPrice(listing.price),
    "",
    idLabel ? `ID ${idLabel} ` : "",
    "",
    propertyType,
    "",
    address ? `${address} ` : "",
    "",
    stats ? `${stats} ` : "",
    "",
    "Your Agent",
    "",
    `Name ${agentName} `,
    `Email ${agentEmail} (mailto:${agentEmail}) `,
    agentPhone ? `Phone ${agentPhone} ` : "",
    "",
    `View Property (${listingUrl})`,
    "",
    "All Agent Connect",
    "",
    "chris@allagentconnect.com (mailto:chris@allagentconnect.com)",
  ].join("\n");
}

async function sendListingShareViaSmtp(opts: {
  to: string;
  subject: string;
  replyTo: string;
  html: string;
  text: string;
  resendApiKey: string;
}): Promise<string | null> {
  assertMigrationDeliveryAllowed();
  const transporter = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: {
      user: "resend",
      pass: opts.resendApiKey,
    },
  });

  const info = await transporter.sendMail({
    from: buildTransactionalFrom(),
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    headers: {
      "List-Unsubscribe": "<mailto:unsubscribe@allagentconnect.com>",
    },
  });

  return typeof info.messageId === "string" ? info.messageId : null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  try {
    const caller = await verifiedPrivacyClient(req);
    if (!caller) return jsonResponse({ success: false, error: 'Not authorized' }, 403);
    assertMigrationDeliveryAllowed();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[send-listing-share] Missing RESEND_API_KEY');
      return jsonResponse({ success: false, error: 'Email configuration missing' }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    let parsed: ShareListingRequest;
    try {
      parsed = await req.json();
    } catch (err) {
      console.error('[send-listing-share] Invalid JSON body:', err);
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const {
      listingId,
      recipientEmail,
      recipientName,
      message = '',
    } = parsed;

    // Caller-supplied names/contact fields never determine the sharing identity.
    const { data: sender, error: senderError } = await supabase.from('agent_profiles')
      .select('first_name,last_name,email,cell_phone,phone,company').eq('id', caller.ownerId).single();
    if (senderError || !sender) return jsonResponse({ success: false, error: 'Not authorized' }, 403);
    const agentName = `${sender.first_name} ${sender.last_name}`.trim();
    const agentEmail = sender.email;
    const agentPhone = sender.cell_phone || sender.phone || '';
    const agentBrokerage = sender.company || '';
    const senderRole = 'agent';

    console.log('[send-listing-share] Received request:', {
      listingId,
      recipientEmail,
      recipientName,
      agentName,
      agentEmail,
      hasMessage: Boolean(message),
    });

    const required: Record<string, unknown> = {
      listingId,
      recipientEmail,
      recipientName,
      agentName,
      agentEmail,
    };
    for (const [field, value] of Object.entries(required)) {
      if (typeof value !== 'string' || value.trim() === '') {
        console.warn(`[send-listing-share] Missing required field: ${field}`);
        return jsonResponse(
          { success: false, error: `Missing required field: ${field}` },
          400,
        );
      }
    }

    const { data: shareToken, error: shareError } = await caller.client.rpc('create_listing_share_link', {
      p_listing_id: listingId, p_recipient_label: recipientEmail,
    });
    if (shareError || !shareToken) return jsonResponse({ success: false, error: 'External sharing is not authorized for this listing' }, 403);

    // Fetch listing details only after the database authorizes external sharing.
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      console.error('[send-listing-share] Listing lookup failed:', listingError);
      return jsonResponse({ success: false, error: 'Listing not found' }, 404);
    }

    const appUrl = resolveEmailBaseUrl(
      Deno.env.get('EMAIL_BASE_URL') || Deno.env.get('APP_URL'),
    );
    const listingUrl = `${appUrl}/s/${shareToken}`;
    listing.secure_share_url = listingUrl;

    const subject = buildAgentSharedPropertyEmailSubject(agentName, listing);
    const variables = {
      recipientName,
      agentName,
      agentEmail,
      agentPhone,
      agentBrokerage,
      message,
      listingUrl,
      listing,
      senderRole,
    };
    const html = renderEmailTemplate('listing-share', variables);
    const text = buildListingShareText({
      recipientName,
      agentName,
      agentEmail,
      agentPhone,
      listingUrl,
      listing,
    });

    const { data: stillAuthorized, error: recheckError } = await caller.client.rpc('get_shared_listing', { p_token: shareToken });
    if (recheckError || !stillAuthorized) return jsonResponse({ success: false, error: 'External sharing is no longer authorized' }, 403);
    console.log(`[send-listing-share] Sending SMTP listing-share to ${recipientEmail}`);
    const providerMessageId = await sendListingShareViaSmtp({
      to: recipientEmail,
      subject,
      replyTo: agentEmail,
      html,
      text,
      resendApiKey,
    });

    console.log(`[send-listing-share] SMTP sent to ${recipientEmail} messageId=${providerMessageId ?? '(none)'}`);

    return jsonResponse({ success: true, message: 'Email sent', providerMessageId }, 200);
  } catch (error: unknown) {
    console.error('[send-listing-share] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
};

serve(handler);
