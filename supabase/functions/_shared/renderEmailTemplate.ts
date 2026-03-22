/* ------------------------------------------------------------------ */
/*  Branded email template renderer                                    */
/*  Extracted from process-email-queue for reuse across edge functions  */
/* ------------------------------------------------------------------ */

import { buildAacEmail } from "./aacEmailTemplate.ts";

export function renderEmailTemplate(
  template: string,
  variables: Record<string, any>,
): string {
  if (variables.html) return variables.html;

  switch (template) {
    case "listing-share":
      return buildAacEmail({
        headline: "Property Shared With You",
        body: `
          ${variables.photoUrl ? `<img src="${variables.photoUrl}" alt="Property" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin:0 0 16px;" />` : ""}
          <p style="margin:0 0 8px;"><strong>Address:</strong> ${variables.address}</p>
          <p style="margin:0 0 8px;"><strong>Price:</strong> ${variables.price}</p>
          ${variables.bedrooms ? `<p style="margin:0 0 8px;"><strong>Bedrooms:</strong> ${variables.bedrooms}</p>` : ""}
          ${variables.bathrooms ? `<p style="margin:0 0 8px;"><strong>Bathrooms:</strong> ${variables.bathrooms}</p>` : ""}
          ${variables.message ? `<p style="margin:0 0 8px;"><strong>Message:</strong> ${variables.message}</p>` : ""}
          <p style="margin:12px 0 0;">Contact ${variables.agentName} at ${variables.agentEmail} for more information.</p>`,
      });

    case "hot-sheet-alert":
      return buildAacEmail({
        headline: "New Properties Match Your Hot Sheet!",
        body: `
          <p style="margin:0 0 12px;">Hi ${variables.userName},</p>
          <p style="margin:0 0 16px;">We found new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
          ${variables.listingsHtml || ""}`,
      });

    case "hot-sheet-invite": {
      const teasers = Array.isArray(variables.teasers) ? variables.teasers.slice(0, 6) : [];
      const teaserHtml = teasers.map((teaser: any) => `
        <div style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          ${teaser.photoUrl ? `<img src="${teaser.photoUrl}" alt="Listing preview" style="display:block;width:100%;height:160px;object-fit:cover;" />` : ""}
          <div style="padding:12px 14px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">${teaser.price || "Price unavailable"}</p>
            <p style="margin:0;color:#4b5563;">${teaser.cityState || "Location unavailable"}${teaser.bedsBaths ? ` • ${teaser.bedsBaths}` : ""}</p>
          </div>
        </div>
      `).join("");

      return buildAacEmail({
        headline: "You've Been Invited to View a Hot Sheet",
        body: `
          <p style="margin:0 0 12px;">${variables.inviterName} has shared their Hot Sheet "${variables.hotSheetName}" with you.</p>
          ${teaserHtml ? `<p style="margin:0 0 12px;">Here are a few matching homes to preview:</p>${teaserHtml}` : ""}`,
        ctaLabel: "Accept Invite & View Matches",
        ctaUrl: variables.hotSheetLink,
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
      const listingAddress = v.listing_address ? String(v.listing_address) : "";
      const listingId = v.listing_id ? String(v.listing_id) : "";

      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

      const safeBody = esc(messageBodyRaw).replace(/\n/g, "<br>");
      const safeSender = esc(senderName);
      const appUrl = Deno.env.get("APP_URL") || "https://allagentconnect.com";
      const ctaHref = ctaUrl.startsWith("http")
        ? ctaUrl
        : `${appUrl}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`;
      const contextLine = listingAddress
        ? `About: ${esc(listingAddress)}`
        : listingId
          ? `About listing #${esc(listingId)}`
          : "";

      return buildAacEmail({
        headline: `New message from ${safeSender}`,
        preheader: (messageBodyRaw || "You have a new message.").replace(/\s+/g, " ").trim().slice(0, 90),
        body: `
          ${contextLine ? `<p style="margin:0 0 12px;font-size:13px;color:#64748b;">${contextLine}</p>` : ""}
          <div style="background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 4px;">
            <p style="margin:0;color:#334155;line-height:1.6;">${safeBody || esc("You have a new message.")}</p>
          </div>`,
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
      const friendName = variables.friendName || "there";
      const inviterName = variables.inviterName || "Someone";
      const inviteLink = variables.inviteLink || "#";

      return buildAacEmail({
        headline: "You're Invited to a Shared Home Search",
        body: `
          <p style="margin:0 0 12px;">Hi ${friendName},</p>
          <p style="margin:0 0 12px;"><strong>${inviterName}</strong> wants to share their home search with you on All Agent Connect.</p>
          <p style="margin:0 0 0;">When you accept, you'll see the same favorites, hot sheets, saved searches, and messages — so you can search together.</p>`,
        ctaLabel: "Accept Invite",
        ctaUrl: inviteLink,
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
