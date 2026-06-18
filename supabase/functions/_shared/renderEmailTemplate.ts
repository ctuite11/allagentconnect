/* ------------------------------------------------------------------ */
/*  Branded email template renderer                                    */
/*  Extracted from process-email-queue for reuse across edge functions  */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";
import { formatListingShareEmailStreetLine } from "./listingShareEmailAddress.ts";
import { renderCompactListingEmailCard, renderListingEmailCard } from "./listingEmailCard.ts";
import { resolveEmailPhotoUrl } from "./listingPhotoUrl.ts";

/* ------------------------------------------------------------------ */
/*  Shared helpers for Share Listings emails                           */
/* ------------------------------------------------------------------ */

function fmtPrice(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num) || num <= 0) return "Price upon request";
  return `$${Math.round(num).toLocaleString()}`;
}

function resolvePhotoUrl(photos: unknown): string {
  return resolveEmailPhotoUrl(photos);
}

function renderListingShareCard(listing: any, opts?: { baseUrl?: string }): string {
  return renderListingEmailCard(listing, { baseUrl: opts?.baseUrl });
}

function renderAgentContactBlock(opts: { agentName: string; agentEmail: string; agentPhone?: string }): string {
  const { agentName, agentEmail, agentPhone } = opts;
  const rows: string[] = [];
  rows.push(`<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Name</td><td style="padding:4px 0 4px 12px;font-weight:600;color:#0f172a;font-size:14px;">${agentName}</td></tr>`);
  rows.push(`<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:4px 0 4px 12px;color:#0E56F5;font-size:14px;"><a href="mailto:${agentEmail}" style="color:#0E56F5;text-decoration:none;">${agentEmail}</a></td></tr>`);
  if (agentPhone) {
    rows.push(`<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:4px 0 4px 12px;font-weight:600;color:#0f172a;font-size:14px;">${agentPhone}</td></tr>`);
  }
  return `
    <div style="margin:24px 0 0;padding:16px 18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Your Agent</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${rows.join("")}</table>
    </div>`;
}

function renderSharedByBlock(opts: {
  agentName: string;
  agentBrokerage?: string;
  agentEmail: string;
  agentPhone?: string;
}): string {
  const { agentName, agentBrokerage, agentEmail, agentPhone } = opts;
  const lines: string[] = [];
  lines.push(`<p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${agentName}</p>`);
  if (agentBrokerage) {
    lines.push(`<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${agentBrokerage}</p>`);
  }
  if (agentEmail) {
    lines.push(`<p style="margin:2px 0 0;font-size:13px;color:#64748b;"><a href="mailto:${agentEmail}" style="color:#64748b;text-decoration:none;">${agentEmail}</a></p>`);
  }
  if (agentPhone) {
    lines.push(`<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${agentPhone}</p>`);
  }
  return `
    <div style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Shared by</p>
      ${lines.join("")}
    </div>`;
}

function renderPersonalMessage(message?: string): string {
  if (!message) return "";
  const safe = String(message).replace(/\n/g, "<br>");
  return `
    <div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border-left:3px solid #0E56F5;border-radius:6px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#0E56F5;text-transform:uppercase;letter-spacing:0.04em;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">Personal Message</p>
      <p style="margin:0;font-size:14px;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${safe}</p>
    </div>`;
}

export function renderEmailTemplate(
  template: string,
  variables: Record<string, any>,
): string {
  if (variables.html) return variables.html;

  switch (template) {
    case "listing-share":
    {
      const recipientName = variables.recipientName || "there";
      const agentName = variables.agentName || "Your agent";
      const agentEmail = variables.agentEmail || "";
      const agentPhone = variables.agentPhone || "";
      const agentBrokerage = variables.agentBrokerage || "";
      const senderRole = variables.senderRole === "buyer" ? "buyer" : "agent";
      const listing = variables.listing || null;
      const listingUrl = variables.listingUrl || "";
      const cardHtml = listing ? renderListingShareCard(listing) : "";

      return buildAacEmail({
        headline: "A Property Has Been Shared With You",
        preheader: `${agentName} shared a property with you`,
        body: `
          <p style="margin:0 0 14px;">Hi ${recipientName},</p>
          <p style="margin:0 0 18px;">${agentName} wants to share a property with you that may interest you:</p>
          ${renderPersonalMessage(variables.message)}
          ${cardHtml}
          ${senderRole === "buyer"
            ? renderSharedByBlock({ agentName, agentBrokerage, agentEmail, agentPhone })
            : renderAgentContactBlock({ agentName, agentEmail, agentPhone })}`,
        ctaLabel: listingUrl ? "View Property" : undefined,
        ctaUrl: listingUrl || undefined,
      });
    }

    case "bulk-listing-share":
    {
      const recipientName = variables.recipientName || "there";
      const agentName = variables.agentName || "Your agent";
      const agentEmail = variables.agentEmail || "";
      const agentPhone = variables.agentPhone || "";
      const listings: any[] = Array.isArray(variables.listings) ? variables.listings : [];
      const count = variables.listingCount || listings.length;
      const cardsHtml = listings.map(renderListingShareCard).join("");

      return buildAacEmail({
        headline: count === 1 ? "A Property Has Been Shared With You" : "Properties Shared With You",
        preheader: `${agentName} shared ${count} ${count === 1 ? "property" : "properties"} with you`,
        body: `
          <p style="margin:0 0 14px;">Hi ${recipientName},</p>
          <p style="margin:0 0 18px;">${agentName} wants to share ${count} ${count === 1 ? "property" : "properties"} with you that may interest you:</p>
          ${renderPersonalMessage(variables.message)}
          ${cardsHtml}
          ${renderAgentContactBlock({ agentName, agentEmail, agentPhone })}`,
      });
    }

    case "hot-sheet-alert":
      return buildAacEmail({
        headline: "New Properties Match Your Hot Sheet!",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.userName},</p>
          <p style="margin:0 0 16px;">We found new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
          ${variables.listingsHtml || ""}`,
      });

    case "founder-invite-1to1": {
      const recipientName = variables.recipientName || "there";
      const ctaUrl = "https://allagentconnect.com/auth?mode=register";
      const benefits: Array<{ title: string; desc: string }> = [
        { title: "Pre-market & off-market inventory", desc: "Discover pre-market and off-market opportunities before they reach the public market." },
        { title: "Buyer need broadcasting", desc: "Put your buyer needs in front of listing agents before inventory reaches the market." },
        { title: "Success Hub command center", desc: "Buyers, listings, hot sheets, referrals, and live market activity in one command center." },
        { title: "Hot Sheets & saved searches", desc: "Real-time alerts for new listings, price drops, status changes, and back-on-market — shareable with buyers in one tap." },
        { title: "Branded buyer dashboard", desc: "Your clients get a dedicated portal under your name: favorites, new matches, messaging, and hot sheet alerts." },
        { title: "Verified agent referral network", desc: "Build trusted relationships with vetted agents across Massachusetts before public launch." },
      ];
      const benefitsList = benefits
        .map(
          (b) =>
            `<li style="margin:0 0 10px;"><strong style="color:#0f172a;">${b.title}.</strong> <span style="color:#475569;">${b.desc}</span></li>`,
        )
        .join("");
      return buildAacEmail({
        headline: "An invitation to become a Founding Partner",
        preheader: "A personal note from Chris Tuite, Founder of All Agent Connect",
        body: `
          <p style="margin:0 0 14px;">Hi ${recipientName},</p>
          <p style="margin:0 0 14px;">Why pay to join a network when you can help launch one?</p>
          <p style="margin:0 0 18px;font-style:italic;color:#334155;">"I built AAC to become something special, and I hope you'll join me as a Founding Partner." — Chris Tuite</p>
          <p style="margin:0 0 10px;">As a Founding Partner, you'll get early access to:</p>
          <ul style="margin:0 0 18px;padding:0 0 0 20px;line-height:1.6;">${benefitsList}</ul>
          <p style="margin:0 0 14px;">You'll also get an early look at Direct Connect MLS and Stealth Seller, and a direct line to share where you believe the industry is headed. Most importantly, I'd like your candid feedback — what works, what doesn't, and what you'd like to see next.</p>
          <p style="margin:0 0 4px;font-weight:600;color:#0f172a;">Chris Tuite</p>
          <p style="margin:0;color:#64748b;font-size:13px;">Founder, All Agent Connect<br/>617-877-0519 · chris@allagentconnect.com</p>`,
        ctaLabel: "Become a Founding Partner",
        ctaUrl,
      });
    }

    case "hot-sheet-invite": {
      // Minimal personal notification (Jun 2026). Aligned with listing-share:
      // no listing teasers, no property detail blocks, simple CTA back to AAC,
      // sender contact in body. Goal: behave like an AAC platform notification,
      // not a property marketing email.
      const recipientFullName = String(variables.recipientName || "there").trim();
      const firstName = recipientFullName.split(/\s+/)[0] || "there";
      const inviterName = variables.inviterName || "Your agent";
      const inviterEmail = variables.inviterEmail || "";
      const inviterPhone = variables.inviterPhone || "";
      const inviterBrokerage = variables.inviterBrokerage || "";
      const hotSheetLink = String(variables.hotSheetLink || "");
      const isInviteOnly = variables.inviteOnly === true || !variables.hotSheetName;

      if (isInviteOnly) {
        return `<!doctype html><html><body><p>hi, see you inside the group</p></body></html>`;
      }

      return buildAacEmail({
        headline: "A hot sheet has been shared with you",
        preheader: `${inviterName} invited you to view a hot sheet`,
        body: `
          <p style="margin:0 0 14px;">Hi ${firstName},</p>
          <p style="margin:0 0 18px;">${inviterName} invited you to view a private hot sheet on All Agent Connect.</p>
          <p style="margin:0 0 18px;">Click below to review the listings and contact your agent through AAC.</p>
          ${renderSharedByBlock({ agentName: inviterName, agentBrokerage: inviterBrokerage, agentEmail: inviterEmail, agentPhone: inviterPhone })}`,
        ctaLabel: "View Hot Sheet",
        ctaUrl: hotSheetLink,
      });
    }

    case "favorites-share":
      return buildAacEmail({
        headline: "Favorite Properties Shared With You",
        body: `
          <p style="margin:0 0 12px;">${variables.senderName} wants to share some properties they've been looking at:</p>
          ${variables.propertiesHtml || ""}`,
        ctaLabel: "View All Properties",
        ctaUrl: variables.shareLink,
      });

    case "buyer-alert":
      return buildAacEmail({
        headline: "New Buyer Alert",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.agentName},</p>
          <p style="margin:0 0 12px;">A new buyer is looking for properties in ${variables.location}.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 12px;">
            <tr><td style="padding:4px 0;color:#64748b;">Property Type:</td><td style="padding:4px 0 4px 12px;font-weight:600;color:#0f172a;">${variables.propertyType}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Max Price:</td><td style="padding:4px 0 4px 12px;font-weight:600;color:#0f172a;">${variables.maxPrice}</td></tr>
            ${variables.bedrooms ? `<tr><td style="padding:4px 0;color:#64748b;">Bedrooms:</td><td style="padding:4px 0 4px 12px;font-weight:600;color:#0f172a;">${variables.bedrooms}+</td></tr>` : ""}
            ${variables.bathrooms ? `<tr><td style="padding:4px 0;color:#64748b;">Bathrooms:</td><td style="padding:4px 0 4px 12px;font-weight:600;color:#0f172a;">${variables.bathrooms}+</td></tr>` : ""}
          </table>
          ${variables.description ? `<p style="margin:0;"><strong>Details:</strong> ${variables.description}</p>` : ""}`,
      });

    case "client-need-notification":
      return buildAacEmail({
        headline: "New Client Need Match",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.agentName},</p>
          <p style="margin:0 0 12px;">A new client need matches your preferences:</p>
          ${variables.contentHtml || ""}`,
      });

    case "seller-alert":
      return buildAacEmail({
        headline: "New Property Matches Your Criteria",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.agentName},</p>
          <p style="margin:0 0 12px;">A new property submission matches your Hot Sheet criteria:</p>
          ${variables.propertyHtml || ""}`,
        ctaLabel: "View Property",
        ctaUrl: variables.viewLink,
      });

    case "reverse-prospecting":
      return buildAacEmail({
        headline: "Reverse Prospecting Alert",
        body: variables.contentHtml || "",
      });

    case "bulk-email":
      return buildAacEmail({
        headline: "",
        body: variables.contentHtml || variables.message || "",
      });

    case "hot-sheet-subscriber-update":
      return buildAacEmail({
        headline: "New matches in your Hot Sheet",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.userName},</p>
          <p style="margin:0 0 16px;">We found ${variables.matchCount} new listing${variables.matchCount !== 1 ? "s" : ""} matching "${variables.hotSheetName}":</p>
          ${variables.listingsHtml || ""}
          <p style="font-size:13px;color:#94a3b8;margin:24px 0 0;">
            You're receiving this because someone added you to this Hot Sheet.
            <a href="${variables.unsubscribeLink}" style="color:#0E56F5;">Unsubscribe</a>
          </p>`,
        ctaLabel: "Forward this Hot Sheet",
        ctaUrl: variables.previewLink,
      });

    case "new-match-notification":
      return buildAacEmail({
        headline: "New matches in your Hot Sheet",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.userName},</p>
          <p style="margin:0 0 16px;">We found ${variables.matchCount} new listings matching "${variables.hotSheetName}":</p>
          ${variables.listingsHtml || ""}`,
        ctaLabel: variables.hotSheetLink ? "Open Hot Sheet" : undefined,
        ctaUrl: variables.hotSheetLink,
      });

    case "hot-sheet-agent-reply":
      return buildAacEmail({
        headline: "New Update in Your Hot Sheet",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.clientName},</p>
          <p style="margin:0 0 12px;"><strong>${variables.agentName}</strong> posted an update about <strong>${variables.listingAddress}</strong> in "${variables.hotSheetName}":</p>
          <div style="background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e5e7eb;margin:16px 0;">
            <p style="margin:0;color:#334155;font-style:italic;">"${variables.commentPreview}"</p>
          </div>`,
        ctaLabel: variables.conversationUrl ? "View Conversation" : undefined,
        ctaUrl: variables.conversationUrl,
      });

    case "hot-sheet-comment":
      return buildAacEmail({
        headline: "New Comment on Your Hot Sheet",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.agentName},</p>
          <p style="margin:0 0 12px;"><strong>${variables.clientName}</strong> commented on <strong>${variables.listingAddress}</strong> in "${variables.hotSheetName}":</p>
          <div style="background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e5e7eb;margin:16px 0;">
            <p style="margin:0;color:#334155;font-style:italic;">"${variables.commentPreview}"</p>
          </div>`,
        ctaLabel: variables.conversationUrl ? "View Conversation" : undefined,
        ctaUrl: variables.conversationUrl,
      });

    case "new-message-notification": {
      const v = variables as Record<string, any>;
      const senderName = String(v.sender_name || "Someone");
      const messageBodyRaw = String(v.message_body || "");
      const ctaUrl = String(v.cta_url || "/messages");

      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

      const safeBody = esc(messageBodyRaw).replace(/\n/g, "<br>");
      const safeSender = esc(senderName);
      const appUrl = Deno.env.get("APP_URL") || "https://allagentconnect.com";
      const ctaHref = ctaUrl.startsWith("http")
        ? ctaUrl
        : `${appUrl}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`;

      const listing =
        v.listing && typeof v.listing === "object" && v.listing.id ? v.listing : null;
      let listingCardHtml = "";
      if (listing) {
        const listingPath =
          typeof v.listing_url === "string" && v.listing_url.trim()
            ? v.listing_url.trim()
            : v.recipient_role === "buyer"
              ? `/consumer-property/${listing.id}`
              : `/property/${listing.id}`;
        const listingHref = listingPath.startsWith("http")
          ? listingPath
          : `${appUrl}${listingPath.startsWith("/") ? listingPath : `/${listingPath}`}`;
        listingCardHtml = renderCompactListingEmailCard(listing, {
          baseUrl: appUrl,
          listingUrl: listingHref,
          ctaLabel: "View listing",
          greenCta: true,
        });
      }

      const messageBlock = `
          <div style="background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 4px;">
            <p style="margin:0;color:#334155;line-height:1.6;">${safeBody || esc("You have a new message.")}</p>
          </div>`;

      return buildAacEmail({
        headline: `New message from ${safeSender}`,
        preheader: (messageBodyRaw || "You have a new message.").replace(/\s+/g, " ").trim().slice(0, 90),
        body: listing
          ? `${listingCardHtml}
          <p style="margin:16px 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Message</p>
          ${messageBlock}`
          : messageBlock,
        ctaLabel: "View Conversation",
        ctaUrl: ctaHref,
      });
    }

    case "client-agent-message": {
      const agentName = variables.agentName || "Agent";
      const clientName = variables.clientName || "Your client";
      const clientEmail = variables.clientEmail || "";
      const msgSubject = variables.subject || "Message from your client";
      const msgBody = variables.message || "";

      return buildAacEmail({
        headline: "Message from Your Client",
        body: `
          <p style="margin:0 0 12px;">Hi ${agentName},</p>
          <p style="margin:0 0 12px;">${clientName}${clientEmail ? ` (${clientEmail})` : ""} sent you a message:</p>
          <p style="margin:0 0 12px;"><strong>Subject:</strong> ${msgSubject}</p>
          <div style="background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 16px;">
            <p style="margin:0;color:#334155;">${String(msgBody).replace(/\n/g, "<br>")}</p>
          </div>
          <p style="font-size:13px;color:#94a3b8;margin:0;">Tip: You can also reply directly to this email to respond.</p>`,
        ctaLabel: "Reply to Client",
        ctaUrl: `mailto:${clientEmail}?subject=Re: ${encodeURIComponent(msgSubject)}`,
      });
    }

    case "buyer-workspace-invite": {
      return `<!doctype html><html><body><p>hi, see you inside the group</p></body></html>`;
    }

    case "agent-client-email": {
      const clientName = variables.clientName || "there";
      const agentName = variables.agentName || "Your agent";
      const agentEmail = variables.agentEmail || "";
      const agentPhone = variables.agentPhone || "";
      const msgSubject = variables.subject || "Message from your agent";
      const msgBody = String(variables.message || "").replace(/\n/g, "<br>");

      return buildAacEmail({
        headline: msgSubject,
        body: `
          <p style="margin:0 0 12px;">Hi ${clientName},</p>
          <div style="margin:0 0 16px;color:#334155;">${msgBody}</div>
          <p style="margin:24px 0 4px;color:#0f172a;font-weight:600;">${agentName}</p>
          ${agentEmail ? `<p style="margin:0;color:#475569;font-size:13px;">${agentEmail}</p>` : ""}
          ${agentPhone ? `<p style="margin:0;color:#475569;font-size:13px;">${agentPhone}</p>` : ""}
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">You can reply directly to this email to respond.</p>`,
      });
    }

    default:
      return buildAacEmail({
        headline: "",
        body: variables.contentHtml ||
          variables.message ||
          `<p style="margin:0;">Email template: ${template}</p>`,
      });
  }
}
