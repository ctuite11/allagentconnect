import { buildDeveloperApprovedEmailHtml } from "./_shared/buildDeveloperApprovedEmailHtml.ts";

const html = buildDeveloperApprovedEmailHtml({
  ctaUrl: "https://allagentconnect.com/set-password?token=preview-token",
  firstName: "Chris",
  ctaNote: "This setup link is valid for 7 days.",
});

const path = "/mnt/documents/developer-approved-email-preview.html";
await Deno.writeTextFile(path, html);
console.log("Preview written to", path);
