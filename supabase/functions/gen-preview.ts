import { buildDeveloperApprovedEmailHtml } from "./_shared/buildDeveloperApprovedEmailHtml.ts";

const html = buildDeveloperApprovedEmailHtml({
  ctaUrl: "https://allagentconnect.com/set-password?token=preview-token",
  firstName: "Chris",
  ctaNote: "This setup link is valid for 7 days.",
});

const path = "/mnt/documents/developer-approved-email-preview.html";
await Deno.writeTextFile(path, html);
console.log("Wrote bytes:", html.length);
const readBack = await Deno.readTextFile(path);
console.log("Read back bytes:", readBack.length);
console.log("Signature line:", readBack.split("\n").find(l => l.includes("Founder"))?.trim());
