import { Link2, Mail, Phone, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import type { AgentProfileRow } from "@/lib/resolveAgentProfileForViewer";
import { cn } from "@/lib/utils";

type SocialLinks = {
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
};

function readSocialLinks(raw: unknown): SocialLinks {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SocialLinks;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as SocialLinks;
  return {};
}

function websiteHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function websiteLabel(raw: string): string {
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function memberSinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Member since ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function pickPhone(agent: AgentProfileRow): string | null {
  const candidates = [agent.cell_phone, agent.phone, agent.office_phone];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

interface AgentMessageProfileDrawerProps {
  agent: AgentProfileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Comms Center in-thread agent profile card.
 * Uses the same `agent_profiles` row as Agent Network / public profile pages —
 * no separate profile system. Closing returns to the exact message thread.
 */
export function AgentMessageProfileDrawer({
  agent,
  open,
  onOpenChange,
}: AgentMessageProfileDrawerProps) {
  if (!agent) return null;

  const firstName = typeof agent.first_name === "string" ? agent.first_name.trim() : "";
  const lastName = typeof agent.last_name === "string" ? agent.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim() || "Agent";
  const brokerage =
    (typeof agent.company === "string" && agent.company.trim()) ||
    (typeof agent.office_name === "string" && agent.office_name.trim()) ||
    (typeof agent.team_name === "string" && agent.team_name.trim()) ||
    null;
  const title = typeof agent.title === "string" && agent.title.trim() ? agent.title.trim() : null;
  const subtitle = [title, brokerage].filter(Boolean).join(" / ") || brokerage;
  const memberSince = memberSinceLabel(
    typeof agent.created_at === "string" ? agent.created_at : null,
  );
  const social = readSocialLinks(agent.social_links);
  const siteHref = websiteHref(social.website ?? null);
  const phoneRaw = pickPhone(agent);
  const phoneDisplay = phoneRaw ? formatPhoneNumber(phoneRaw) : "";
  const phoneHref =
    phoneRaw && phoneDisplay && phoneDisplay !== "—"
      ? `tel:${phoneRaw.replace(/[^\d+]/g, "")}`
      : null;
  const email = typeof agent.email === "string" && agent.email.trim() ? agent.email.trim() : null;
  const bio = typeof agent.bio === "string" && agent.bio.trim() ? agent.bio.trim() : null;
  const headshot =
    typeof agent.headshot_url === "string" && agent.headshot_url.trim()
      ? agent.headshot_url.trim()
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full max-w-full flex-col gap-0 overflow-y-auto overflow-x-hidden p-0 sm:max-w-[400px]",
          // Hide the default sheet close — we render an explicit Back/Close for mobile clarity.
          "[&>button]:hidden",
        )}
      >
        <div className="sr-only">
          <SheetTitle>{fullName} profile</SheetTitle>
        </div>

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-[#0E56F5] transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40"
          >
            Back to conversation
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close agent profile"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8 pt-8">
          {/* Identity — centered business-card header */}
          <div className="flex flex-col items-center text-center">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 shadow-sm">
              {headshot ? (
                <img
                  src={headshot}
                  alt={fullName}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[22px] font-semibold text-neutral-600">
                  {(firstName[0] || "").toUpperCase()}
                  {(lastName[0] || "").toUpperCase() || "A"}
                </div>
              )}
            </div>
            <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-neutral-900">
              {fullName}
            </h2>
            {subtitle ? (
              <p className="mt-1 max-w-[280px] text-[14px] leading-snug text-neutral-500">
                {subtitle}
              </p>
            ) : null}
            {memberSince ? (
              <p className="mt-1.5 text-[12px] text-neutral-400">{memberSince}</p>
            ) : null}
          </div>

          {/* Contact rows */}
          {(siteHref || phoneHref || email) && (
            <ul className="mt-8 space-y-3.5">
              {siteHref && social.website ? (
                <li>
                  <a
                    href={siteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-2.5 text-[14px] text-[#0E56F5] transition-colors hover:underline underline-offset-2"
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
                    <span className="truncate">{websiteLabel(social.website)}</span>
                  </a>
                </li>
              ) : null}
              {phoneHref && phoneDisplay !== "—" ? (
                <li>
                  <a
                    href={phoneHref}
                    className="inline-flex max-w-full items-center gap-2.5 text-[14px] text-neutral-800 transition-colors hover:text-[#0E56F5]"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
                    <span>{phoneDisplay}</span>
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex max-w-full items-center gap-2.5 text-[14px] text-neutral-800 transition-colors hover:text-[#0E56F5]"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
                    <span className="truncate">{email}</span>
                  </a>
                </li>
              ) : null}
            </ul>
          )}

          {/* Bio */}
          {bio ? (
            <div className="mt-8 border-t border-neutral-100 pt-6">
              <h3 className="text-[13px] font-semibold text-neutral-900">Bio</h3>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.65] text-neutral-600">
                {bio}
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AgentMessageProfileDrawer;
