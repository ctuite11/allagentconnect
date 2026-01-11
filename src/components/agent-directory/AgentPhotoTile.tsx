import React from "react";
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

  return (
    <button
      type="button"
      onClick={() => onClick(agent.id)}
      className="group w-full text-left"
    >
      {/* Card container */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
        {/* PHOTO - 3:4 portrait ratio */}
        <div className="aspect-[3/4] w-full overflow-hidden bg-white leading-[0]">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className="block h-full w-full object-cover transition-opacity group-hover:opacity-95"
              style={{ display: 'block', lineHeight: 0, fontSize: 0 }}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-white">
              <span className="text-xl font-semibold tracking-tight">
                <span style={{ color: '#0E56F5' }}>All Agent</span>{' '}
                <span className="text-zinc-400">Connect</span>
              </span>
            </div>
          )}
        </div>

        {/* TEXT BLOCK */}
        <div className="px-5 pb-5 pt-5">
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
