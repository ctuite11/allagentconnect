Remove the gray background from the Hot Sheets mock image used in the Private Listing Network email.

1. Edit the existing Hot Sheets mock (currently at `email-attachments/early-access-v2/06-hot-sheets.png`) using imagegen edit to replace the gray page background with pure white (#FFFFFF). Keep all 6 hot sheet cards, headers, icons, pills, and layout pixel-identical — only the surrounding page/background color changes.
2. Re-upload the edited PNG to Supabase Storage at `email-attachments/early-access-v2/06-hot-sheets.png`, overwriting the current image.
3. Bump `IMG_VERSION_V2` from `"v7"` → `"v8"` in `supabase/functions/send-bulk-email/index.ts` so email clients pull the new image.
4. Redeploy the `send-bulk-email` edge function.