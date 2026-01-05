import React from "react";
import NetworkGlobe from "@/components/home/NetworkGlobe";
import { formatPhoneNumber } from "@/lib/phoneFormat";

type Agent = {
  id: string;
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
  onClick: (id: string) => void;
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

export default function AgentPhotoTile({ agent, onClick }: Props) {
  const rawName =
    [agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Agent";
  const fullName = titleCase(rawName);

  const brokerage = agent.company || agent.office_name || agent.team_name || "";

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <button
      type="button"
      onClick={() => onClick(agent.id)}
      className="group w-full text-left"
    >
      {/* Card container with AAC border */}
      <div className="border border-zinc-200 overflow-hidden">
        {/* PHOTO - 3:4 portrait ratio (Compass style) */}
        <div className="aspect-[3/4] w-full overflow-hidden bg-zinc-100">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className="h-full w-full object-cover transition-opacity group-hover:opacity-95"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-emerald-600">
              <div className="h-44 w-44 text-white">
                <NetworkGlobe variant="static" strokeColor="currentColor" />
              </div>
            </div>
          )}
        </div>

        {/* TEXT BLOCK - Compass style with border-top */}
        <div className="border-t border-zinc-200 px-5 pb-5 pt-5">
          <div className="text-[18px] leading-[22px] font-semibold text-zinc-900 truncate">
            {fullName}
          </div>
          <div className="mt-2 text-[14px] leading-[18px] text-zinc-600 truncate">
            {brokerage || <span className="text-transparent">.</span>}
          </div>
          <div className="mt-1 text-[14px] leading-[18px] text-zinc-600 truncate">
            {agent.email || <span className="text-transparent">.</span>}
          </div>
          <div className="mt-1 text-[14px] leading-[18px] text-zinc-600 truncate">
            {agent.cell_phone || agent.phone ? `M: ${formatPhoneNumber(agent.cell_phone || agent.phone)}` : <span className="text-transparent">.</span>}
          </div>
        </div>
      </div>
    </button>
  );
}