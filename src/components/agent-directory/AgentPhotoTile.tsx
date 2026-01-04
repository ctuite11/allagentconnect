import React from "react";

type Agent = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  office_name?: string | null;
  team_name?: string | null;
  cell_phone?: string | null;
  phone?: string | null;
  email?: string | null;
  headshot_url?: string | null;
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
    <div
      onClick={() => onClick(agent.id)}
      className="cursor-pointer"
    >
      {/* Photo - 3:4 aspect ratio, square corners (Compass-style) */}
      <div className="aspect-[3/4] w-full overflow-hidden bg-zinc-100">
        {agent.headshot_url ? (
          <img
            src={agent.headshot_url}
            alt={fullName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-400">
            {initials}
          </div>
        )}
      </div>

      {/* Info - Name + Brokerage only (Compass parity) */}
      <div className="mt-3">
        <div className="text-lg font-semibold text-zinc-900">
          {fullName}
        </div>
        <div className="mt-1 text-sm text-zinc-600">
          {brokerage || "Licensed Agent"}
        </div>
      </div>
    </div>
  );
}
