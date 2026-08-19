const path = "/mnt/documents/developer-approved-email-preview-v2.html";
await Deno.writeTextFile(path, "<p>Founder</p>");
const readBack = await Deno.readTextFile(path);
console.log("Wrote v2. Read back:", readBack);
