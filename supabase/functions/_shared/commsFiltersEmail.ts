/**
 * Communications Center broadcast/digest filter-management copy + links.
 * Do not use for Hot Sheet, transactional, DM, or activation emails.
 */

import { AAC_PUBLIC_URL } from "./aacPublicUrl.ts";

/** Deep-link to Communications Center Filters (email alert settings section). */
export const COMMS_FILTERS_PATH = "/communications?section=filters";
export const COMMS_FILTERS_URL = `${AAC_PUBLIC_URL}${COMMS_FILTERS_PATH}`;

export const COMMS_FILTERS_NOTICE_HEADING =
  "Don’t want to receive messages like this?";
export const COMMS_FILTERS_NOTICE_BODY =
  "Update your filters in the Communications Center.";
export const COMMS_FILTERS_CTA_LABEL = "Update My Filters";
export const COMMS_FILTERS_FOOTER_REMINDER =
  "You’re receiving this because of your Communications Center filters. Review your filters.";

/** Prominent block placed directly below the email heading. */
export function buildCommsFiltersNoticeHtml(filtersUrl: string = COMMS_FILTERS_URL): string {
  return `
    <div style="margin:0 0 20px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0f172a;line-height:1.4;">
        ${COMMS_FILTERS_NOTICE_HEADING}
      </p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155;">
        ${COMMS_FILTERS_NOTICE_BODY}
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr><td>
          <a href="${filtersUrl}" target="_blank"
             style="display:inline-block;padding:12px 22px;background-color:#0E56F5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">
            ${COMMS_FILTERS_CTA_LABEL}
          </a>
        </td></tr>
      </table>
    </div>`;
}

/** Smaller footer reminder with a filters review link. */
export function buildCommsFiltersFooterHtml(filtersUrl: string = COMMS_FILTERS_URL): string {
  return `
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
      You’re receiving this because of your Communications Center filters.
      <a href="${filtersUrl}" target="_blank" style="color:#0E56F5;text-decoration:underline;">Review your filters</a>.
    </p>`;
}
