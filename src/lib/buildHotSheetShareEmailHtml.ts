function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildHotSheetShareEmailHtml(params: {
  userMessage: string;
  reviewUrl: string;
  title: string;
  description?: string;
}): string {
  const { userMessage, reviewUrl, title, description } = params;
  const safeUrl = escapeHtml(reviewUrl);
  const safeTitle = escapeHtml(title);

  const messageBlock = userMessage.trim()
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(userMessage.trim()).replace(/\n/g, "<br>")}</p>`
    : "";

  const descriptionLine = description?.trim()
    ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.4;">${escapeHtml(description.trim())}</p>`
    : "";

  const card = [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:8px 0;background:#ffffff;">`,
    `<tr><td style="padding:18px 20px;">`,
    `<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">Hot Sheet</p>`,
    `<p style="margin:6px 0 0;font-size:17px;font-weight:600;color:#111827;line-height:1.3;">${safeTitle}</p>`,
    descriptionLine,
    `<div style="margin-top:16px;">`,
    `<a href="${safeUrl}" style="display:inline-block;background:#0E56F5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">View matches</a>`,
    `</div>`,
    `</td></tr>`,
    `</table>`,
  ].join("");

  return `<div>${messageBlock}${card}</div>`;
}
