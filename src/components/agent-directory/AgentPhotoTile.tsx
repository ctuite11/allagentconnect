import React from "react";
import NetworkGlobe from "@/components/home/NetworkGlobe";

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
            <div className="h-full w-full bg-white">
              <NetworkGlobe variant="static" />
            </div>
          )}
        </div>

        {/* TEXT BLOCK - Fixed height for uniform cards */}
        <div className="px-4 py-4 h-28">
          <div className="text-lg font-semibold leading-tight text-zinc-900 truncate">
            {fullName}
          </div>
          <div className="mt-1 text-sm text-zinc-500 truncate">
            {brokerage || "\u00A0"}
          </div>
          <div className="mt-1 text-sm text-zinc-500 truncate">
            {agent.cell_phone || agent.phone || "\u00A0"}
          </div>
          <div className="mt-1 text-sm text-zinc-500 truncate">
            {agent.email || "\u00A0"}
          </div>
        </div>
      </div>
    </button>
  );
}