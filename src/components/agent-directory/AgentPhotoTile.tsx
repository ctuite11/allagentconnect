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
  const phone = agent.cell_phone || agent.phone || "";
  const email = agent.email || "";

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
      {/* Photo - 3:4 aspect ratio */}
      <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-zinc-100">
        {agent.headshot_url ? (
          <img
            src={agent.headshot_url}
            alt={fullName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-zinc-400">
            {initials}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 space-y-1">
        <div className="text-base font-semibold text-zinc-900">
          {fullName}
        </div>

        {brokerage && (
          <div className="text-sm text-zinc-600">
            {brokerage}
          </div>
        )}

        {email && (
          <div className="text-sm text-zinc-500">
            {email}
          </div>
        )}

        {phone && (
          <div className="text-sm text-zinc-500">
            {phone}
          </div>
        )}
      </div>
    </div>
  );
}
