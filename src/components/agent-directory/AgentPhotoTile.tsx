import React from "react";
import { formatPhoneNumber } from "@/lib/phoneFormat";

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
  onClick: (id: string) => void;
  isOnline?: boolean;
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

export default function AgentPhotoTile({ agent, onClick, isOnline }: Props) {
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
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-white leading-[0]">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className="block h-full w-full object-cover transition-opacity group-hover:opacity-95"
              style={{ display: 'block', lineHeight: 0, fontSize: 0 }}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-primary">
              <svg viewBox="0 0 34 34" className="w-16 h-16 text-white" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.6667 11.3333H11.3333V22.6667H22.6667V11.3333Z" />
                <path d="M2.83333 26.9167C2.83333 29.2542 4.74583 31.1667 7.08333 31.1667C9.42083 31.1667 11.3333 29.2542 11.3333 26.9167V22.6667H7.08333C4.74583 22.6667 2.83333 24.5792 2.83333 26.9167Z" />
                <path d="M7.08333 2.83333C4.74583 2.83333 2.83333 4.74583 2.83333 7.08333C2.83333 9.42083 4.74583 11.3333 7.08333 11.3333H11.3333V7.08333C11.3333 4.74583 9.42083 2.83333 7.08333 2.83333Z" />
                <path d="M31.1667 7.08333C31.1667 4.74583 29.2542 2.83333 26.9167 2.83333C24.5792 2.83333 22.6667 4.74583 22.6667 7.08333V11.3333H26.9167C29.2542 11.3333 31.1667 9.42083 31.1667 7.08333Z" />
                <path d="M26.9167 22.6667H22.6667V26.9167C22.6667 29.2542 24.5792 31.1667 26.9167 31.1667C29.2542 31.1667 31.1667 29.2542 31.1667 26.9167C31.1667 24.5792 29.2542 22.6667 26.9167 22.6667Z" />
              </svg>
            </div>
          )}
          {isOnline && (
            <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
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
