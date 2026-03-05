/* ------------------------------------------------------------------ */
/*  Branded email template renderer                                    */
/*  Extracted from process-email-queue for reuse across edge functions  */
/* ------------------------------------------------------------------ */

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#27272a;background:#f4f4f5;}
.outer{max-width:600px;margin:0 auto;padding:24px 16px;}
.card{background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;}
.header{padding:28px 24px 20px;text-align:center;border-bottom:1px solid #e4e4e7;}
.wordmark{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;}
.wordmark-blue{color:#0E56F5;}
.wordmark-gray{color:#94A3B8;}
.blue-line{display:block;width:48px;height:3px;background:#0E56F5;border-radius:2px;margin:12px auto 0;}
.content{padding:28px 24px 32px;}
.content h2{font-size:20px;font-weight:600;color:#18181b;margin:0 0 16px;}
.content p{margin:0 0 12px;color:#3f3f46;}
.cta-wrap{margin:28px 0 0;text-align:center;}
.cta{display:inline-block;padding:14px 28px;background:#0F172A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;letter-spacing:0.01em;}
.cta-dot{display:inline-block;width:8px;height:8px;background:#10B981;border-radius:50%;margin-right:8px;vertical-align:middle;}
.cta-arrow{margin-left:8px;vertical-align:middle;}
.quote-block{background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #0E56F5;}
.quote-block p{margin:0;color:#3f3f46;font-style:italic;}
.footer{padding:20px 24px;text-align:center;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7;}
.footer a{color:#0E56F5;text-decoration:none;}
.footer p{margin:4px 0;}
</style></head><body>
<div class="outer"><div class="card">
<div class="header">
  <span class="wordmark"><span class="wordmark-blue">All Agent </span><span class="wordmark-gray">Connect</span></span>
  <span class="blue-line"></span>
</div>
<div class="content">${content}</div>
<div class="footer">
  <p>All Agent Connect – Complete Transparency in Real Estate</p>
  <p>Questions? <a href="mailto:hello@allagentconnect.com">hello@allagentconnect.com</a></p>
  <p style="margin-top:8px;"><a href="mailto:hello@allagentconnect.com?subject=Remove%20My%20Account">Remove my account</a></p>
</div>
</div></div>
</body></html>`;
}

export function renderEmailTemplate(
  template: string,
  variables: Record<string, any>,
): string {
  if (variables.html) return variables.html;

  switch (template) {
    case "listing-share":
      return wrapHtml(`
        <h2>Property Shared With You</h2>
        ${variables.photoUrl ? `<img src="${variables.photoUrl}" alt="Property" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;" />` : ""}
        <p><strong>Address:</strong> ${variables.address}</p>
        <p><strong>Price:</strong> ${variables.price}</p>
        ${variables.bedrooms ? `<p><strong>Bedrooms:</strong> ${variables.bedrooms}</p>` : ""}
        ${variables.bathrooms ? `<p><strong>Bathrooms:</strong> ${variables.bathrooms}</p>` : ""}
        ${variables.message ? `<p><strong>Message:</strong> ${variables.message}</p>` : ""}
        <p>Contact ${variables.agentName} at ${variables.agentEmail} for more information.</p>`);

    case "hot-sheet-alert":
      return wrapHtml(`
        <h2>New Properties Match Your Hot Sheet!</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found new listings matching your Hot Sheet "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}
        <p>Don't miss out on these opportunities!</p>`);

    case "hot-sheet-invite": {
      const teasers = Array.isArray(variables.teasers) ? variables.teasers.slice(0, 6) : [];
      const teaserHtml = teasers.map((teaser: any) => `
        <div style="margin: 0 0 16px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          ${teaser.photoUrl ? `<img src="${teaser.photoUrl}" alt="Listing preview" style="display:block;width:100%;height:160px;object-fit:cover;" />` : ""}
          <div style="padding: 12px 14px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">${teaser.price || "Price unavailable"}</p>
            <p style="margin:0;color:#4b5563;">${teaser.cityState || "Location unavailable"}${teaser.bedsBaths ? ` • ${teaser.bedsBaths}` : ""}</p>
          </div>
        </div>
      `).join("");

      return wrapHtml(`
        <h2>You've Been Invited to View a Hot Sheet</h2>
        <p>${variables.inviterName} has shared their Hot Sheet "${variables.hotSheetName}" with you.</p>
        ${teaserHtml ? `<p>Here are a few matching homes to preview:</p>${teaserHtml}` : ""}
        <div class="cta-wrap"><a href="${variables.hotSheetLink}" class="cta"><span class="cta-dot"></span>Accept Invite & View Matches<span class="cta-arrow">&rarr;</span></a></div>`);
    }

    case "favorites-share":
      return wrapHtml(`
        <h2>Favorite Properties Shared With You</h2>
        <p>${variables.senderName} wants to share some properties they've been looking at:</p>
        ${variables.propertiesHtml || ""}
        <div class="cta-wrap"><a href="${variables.shareLink}" class="cta"><span class="cta-dot"></span>View All Properties<span class="cta-arrow">&rarr;</span></a></div>`);

    case "buyer-alert":
      return wrapHtml(`
        <h2>New Buyer Alert</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new buyer is looking for properties in ${variables.location}!</p>
        <ul>
          <li><strong>Property Type:</strong> ${variables.propertyType}</li>
          <li><strong>Max Price:</strong> ${variables.maxPrice}</li>
          ${variables.bedrooms ? `<li><strong>Bedrooms:</strong> ${variables.bedrooms}+</li>` : ""}
          ${variables.bathrooms ? `<li><strong>Bathrooms:</strong> ${variables.bathrooms}+</li>` : ""}
        </ul>
        ${variables.description ? `<p><strong>Details:</strong> ${variables.description}</p>` : ""}`);

    case "client-need-notification":
      return wrapHtml(`
        <h2>New Client Need Match</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new client need matches your preferences:</p>
        ${variables.contentHtml || ""}`);

    case "seller-alert":
      return wrapHtml(`
        <h2>New Property Matches Your Criteria!</h2>
        <p>Hi ${variables.agentName},</p>
        <p>A new property submission matches your Hot Sheet criteria:</p>
        ${variables.propertyHtml || ""}
        <div class="cta-wrap"><a href="${variables.viewLink}" class="cta"><span class="cta-dot"></span>View Property<span class="cta-arrow">&rarr;</span></a></div>`);

    case "reverse-prospecting":
      return wrapHtml(`<h2>Reverse Prospecting Alert</h2><p>${variables.contentHtml || ""}</p>`);

    case "bulk-email":
      return wrapHtml(variables.contentHtml || variables.message || "");

    case "hot-sheet-subscriber-update":
      return wrapHtml(`
        <h2>New matches in your Hot Sheet</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found ${variables.matchCount} new listing${variables.matchCount !== 1 ? "s" : ""} matching "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}
        <div class="cta-wrap">
          <a href="${variables.previewLink}" class="cta"><span class="cta-dot"></span>Forward this Hot Sheet<span class="cta-arrow">&rarr;</span></a>
        </div>
        <p style="font-size:13px;color:#71717a;margin-top:24px;">
          You're receiving this because someone added you to this Hot Sheet.
          <a href="${variables.unsubscribeLink}" style="color:#0E56F5;">Unsubscribe</a>
        </p>`);

    case "new-match-notification":
      return wrapHtml(`
        <h2>New matches in your Hot Sheet</h2>
        <p>Hi ${variables.userName},</p>
        <p>We found ${variables.matchCount} new listings matching "${variables.hotSheetName}":</p>
        ${variables.listingsHtml || ""}
        ${variables.hotSheetLink ? `<div class="cta-wrap"><a href="${variables.hotSheetLink}" class="cta"><span class="cta-dot"></span>Open Hot Sheet<span class="cta-arrow">&rarr;</span></a></div>` : ""}`);

    case "hot-sheet-agent-reply":
      return wrapHtml(`
        <h2>New Update in Your Hot Sheet</h2>
        <p>Hi ${variables.clientName},</p>
        <p><strong>${variables.agentName}</strong> posted an update about
           <strong>${variables.listingAddress}</strong> in
           "${variables.hotSheetName}":</p>
        <div class="quote-block">
          <p>"${variables.commentPreview}"</p>
        </div>
        ${variables.conversationUrl ? `<div class="cta-wrap"><a href="${variables.conversationUrl}" class="cta"><span class="cta-dot"></span>View Conversation<span class="cta-arrow">&rarr;</span></a></div>` : '<p>Log in to view the full conversation.</p>'}`);
    case "hot-sheet-comment":
      return wrapHtml(`
        <h2>New Comment on Your Hot Sheet</h2>
        <p>Hi ${variables.agentName},</p>
        <p><strong>${variables.clientName}</strong> commented on
           <strong>${variables.listingAddress}</strong> in
           "${variables.hotSheetName}":</p>
        <div class="quote-block">
          <p>"${variables.commentPreview}"</p>
        </div>
        ${variables.conversationUrl ? `<div class="cta-wrap"><a href="${variables.conversationUrl}" class="cta"><span class="cta-dot"></span>View Conversation<span class="cta-arrow">&rarr;</span></a></div>` : '<p>Log in to your dashboard to view and respond.</p>'}`);

    case "new-message-notification": {
      const v = variables as Record<string, any>;
      const senderName = String(v.sender_name || "Someone");
      const messageBodyRaw = String(v.message_body || "");
      const ctaUrl = String(v.cta_url || "/messages");
      const listingAddress = v.listing_address ? String(v.listing_address) : "";
      const listingId = v.listing_id ? String(v.listing_id) : "";
      const preview = (messageBodyRaw || "").replace(/\s+/g, " ").trim().slice(0, 90);

      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

      const safeBody = escapeHtml(messageBodyRaw).replace(/\n/g, "<br>");
      const safeSender = escapeHtml(senderName);

      const initials = safeSender
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase() || "")
        .join("") || "?";

      const appUrl = Deno.env.get("APP_URL") || "https://allagentconnect.com";
      const ctaHref = ctaUrl.startsWith("http")
        ? ctaUrl
        : `${appUrl}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`;
      const preheader = escapeHtml(preview || "You have a new message.");
      const contextLine = listingAddress
        ? `About: ${escapeHtml(listingAddress)}`
        : listingId
          ? `About listing #${escapeHtml(listingId)}`
          : "";

      return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>New message from ${safeSender}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .bg { background:#0b1220 !important; }
      .card { background:#0f172a !important; }
      .text { color:#e5e7eb !important; }
      .muted { color:#94a3b8 !important; }
      .border { border-color:#1f2937 !important; }
      .quote { background:#0b1220 !important; border-color:#1f2937 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#f8fafc;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr><td style="padding:0 0 24px 0; text-align:center;">
          <span style="font-size:18px; font-weight:800; letter-spacing:-0.03em;">
            <span style="color:#0E56F5;">All Agent</span><span style="color:#94A3B8;">&nbsp;Connect</span>
          </span>
          <div style="width:40px; height:3px; background:#0E56F5; margin:8px auto 0; border-radius:2px;"></div>
        </td></tr>
        <tr><td class="card" style="background:#ffffff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:24px 24px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:44px; vertical-align:top;">
                    <div style="width:44px; height:44px; border-radius:50%; background:#0E56F5; color:#ffffff; font-size:16px; font-weight:700; line-height:44px; text-align:center;">${escapeHtml(initials)}</div>
                  </td>
                  <td style="padding-left:14px; vertical-align:middle;">
                    <div class="text" style="font-size:16px; font-weight:700; color:#0f172a; line-height:1.3;">New message from ${safeSender}</div>
                    ${contextLine ? `<div class="muted" style="font-size:13px; color:#64748b; margin-top:2px;">${contextLine}</div>` : ``}
                  </td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 24px 20px;">
              <div class="quote" style="background:#f8fafc; border-left:4px solid #0E56F5; border-radius:0 8px 8px 0; padding:16px; font-size:15px; line-height:1.6; color:#334155;">
                ${safeBody || escapeHtml("You have a new message.")}
              </div>
            </td></tr>
            <tr><td style="padding:0 24px 28px; text-align:center;">
              <a href="${ctaHref}" target="_blank" style="display:inline-block; background:#0F172A; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none; letter-spacing:0.01em;">
                <span style="color:#10B981; font-size:10px; vertical-align:middle;">&#9679;</span>&nbsp;&nbsp;View Conversation&nbsp;&nbsp;&rarr;
              </a>
              <div class="muted" style="font-size:11px; color:#94a3b8; margin-top:10px; word-break:break-all;">
                If the button doesn&rsquo;t work, open: ${escapeHtml(ctaHref)}
              </div>
            </td></tr>
            <tr><td class="border" style="border-top:1px solid #e5e7eb; padding:20px 24px;">
              <div class="muted" style="font-size:12px; color:#94a3b8; text-align:center; line-height:1.6;">
                All Agent Connect &mdash; Private Agent Network<br>
                Questions? <a href="mailto:hello@allagentconnect.com" style="color:#0E56F5; font-weight:700;">hello@allagentconnect.com</a>
              </div>
              <div style="text-align:center; margin-top:10px;">
                <a href="mailto:hello@allagentconnect.com?subject=Remove%20my%20account" style="font-size:11px; color:#94a3b8; text-decoration:underline;">Remove my account</a>
              </div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 0 0; text-align:center;">
          <div class="muted" style="font-size:11px; color:#94a3b8;">&copy; ${new Date().getFullYear()} All Agent Connect</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }

    case "client-agent-message": {
      const agentName = variables.agentName || "Agent";
      const clientName = variables.clientName || "Your client";
      const clientEmail = variables.clientEmail || "";
      const msgSubject = variables.subject || "Message from your client via AllAgentConnect";
      const msgBody = variables.message || "";

      return wrapHtml(`
        <h2>Message from Your Client</h2>
        <p>Hi ${agentName},</p>
        <p>${clientName}${clientEmail ? ` (${clientEmail})` : ""} sent you a message:</p>
        <p><strong>Subject:</strong> ${msgSubject}</p>
        <div class="quote-block">
          <p>${String(msgBody).replace(/\n/g, "<br>")}</p>
        </div>
        <div class="cta-wrap">
          <a href="mailto:${clientEmail}?subject=Re: ${encodeURIComponent(msgSubject)}" class="cta">
            <span class="cta-dot"></span>Reply to Client<span class="cta-arrow">&rarr;</span>
          </a>
        </div>
        <p style="font-size:13px;color:#71717a;margin-top:16px;">
          Tip: You can also reply directly to this email to respond.
        </p>`);
    }

    case "buyer-workspace-invite": {
      const friendName = variables.friendName || "there";
      const inviterName = variables.inviterName || "Someone";
      const inviteLink = variables.inviteLink || "#";

      return wrapHtml(`
        <h2>You're Invited to a Shared Home Search</h2>
        <p>Hi ${friendName},</p>
        <p><strong>${inviterName}</strong> wants to share their home search with you on All Agent Connect.</p>
        <p>When you accept, you'll see the same favorites, hot sheets, saved searches, and messages — so you can search together.</p>
        <div class="cta-wrap"><a href="${inviteLink}" class="cta"><span class="cta-dot"></span>Accept Invite<span class="cta-arrow">&rarr;</span></a></div>`);
    }

    default:
      return wrapHtml(
        variables.contentHtml ||
          variables.message ||
          `<p>Email template: ${template}</p>`,
      );
  }
}
