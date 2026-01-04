import React from "react";

type Agent = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  office_name?: string | null;
  team_name?: string | null;
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
    <button
      type="button"
      onClick={() => onClick(agent.id)}
      className="group w-full text-left"
    >
      {/* Outer border box (Compass look) */}
      <div className="border border-zinc-200 bg-white">
        {/* PHOTO - 3:4 portrait ratio */}
        <div className="aspect-[3/4] w-full overflow-hidden bg-zinc-100">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className="h-full w-full object-cover transition-opacity group-hover:opacity-95"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-4xl font-semibold tracking-wide text-zinc-300">
                {initials}
              </div>
            </div>
          )}
        </div>

        {/* TEXT BLOCK (separate panel feel) */}
        <div className="border-t border-zinc-200 px-5 pb-4 pt-5">
          <div className="text-lg font-semibold leading-tight text-zinc-900">
            {fullName}
          </div>

          {brokerage ? (
            <div className="mt-2 text-sm leading-snug text-zinc-600">
              {brokerage}
            </div>
          ) : (
            <div className="mt-2 text-sm leading-snug text-transparent">
              .
            </div>
          )}
        </div>
      </div>
    </button>
  );
}