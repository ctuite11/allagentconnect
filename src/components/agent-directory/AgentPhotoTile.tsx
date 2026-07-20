import React from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { initialsFromDisplayName } from "@/lib/initials";

type Agent = {
  id: string;
  aac_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  office_name?: string | null;
  team_name?: string | null;
  headshot_url?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
  email?: string | null;
};

type Props = {
  agent: Agent;
  onClick?: (id: string) => void;
  /** When true, show emerald Online badge beside the name (referral network only). */
  showPresenceBadge?: boolean;
  isOnline?: boolean;
  hideDirectContact?: boolean;
  /**
   * When false, render the same card chrome as a non-clickable surface
   * (e.g. Comms Center profile pop-up). Defaults to true so Agent Network
   * grid tiles are unchanged.
   */
  interactive?: boolean;
};

function titleCase(s: string) {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function AgentPhotoTile({
  agent,
  onClick,
  showPresenceBadge = false,
  isOnline = false,
  hideDirectContact = false,
  interactive = true,
}: Props) {
  const rawName =
    [agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Agent";
  const fullName = titleCase(rawName);

  const brokerage = agent.company || agent.office_name || agent.team_name || "";

  const card = (
      <div
        className={
          interactive
            ? "overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color,transform] duration-200 ease-out group-hover:-translate-y-px group-hover:border-neutral-300/90 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)]"
            : "overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        }
      >
        {/* PHOTO — online presence shown as a dot overlay so card heights stay uniform */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-white leading-[0]">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className={
                interactive
                  ? "block h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-[0.97]"
                  : "block h-full w-full object-cover"
              }
              style={{ display: "block", lineHeight: 0, fontSize: 0 }}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-100">
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200 text-2xl font-semibold tracking-wide text-neutral-600"
                aria-label={`${fullName} initials`}
              >
                {initialsFromDisplayName(fullName)}
              </span>
            </div>
          )}
          {showPresenceBadge && isOnline ? (
            <span
              className="absolute right-2.5 top-2.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#22C55E] ring-2 ring-white shadow-sm"
              title="Online"
              aria-label="Online"
            />
          ) : null}
        </div>

        {/* TEXT BLOCK */}
        <div className="px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
          <p className="text-[17px] font-semibold leading-snug tracking-tight text-neutral-900 md:text-[18px]">
            <span className="block truncate">{fullName}</span>
          </p>
          <div className="mt-1.5 truncate text-[13px] leading-snug text-neutral-600 md:text-[14px]">
            {brokerage || <span className="text-transparent">.</span>}
          </div>
          {hideDirectContact ? (
            <div className="mt-3 text-[13px] font-medium text-neutral-900">View profile</div>
          ) : (
            <>
              <div className="mt-1 text-[14px] leading-[18px] text-zinc-600 truncate">
                {agent.email || <span className="text-transparent">.</span>}
              </div>
              <div className="mt-1 text-[14px] leading-[18px] text-zinc-600 truncate">
                {agent.cell_phone || agent.phone ? `M: ${formatPhoneNumber(agent.cell_phone || agent.phone)}` : <span className="text-transparent">.</span>}
              </div>
            </>
          )}
        </div>
      </div>
  );

  if (!interactive) {
    return <div className="w-full rounded-2xl">{card}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(agent.id)}
      className="group w-full rounded-2xl text-left outline-none transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
    >
      {card}
    </button>
  );
}
