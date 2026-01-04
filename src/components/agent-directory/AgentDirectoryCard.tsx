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
  onViewProfile?: (id: string) => void;
  onMessage?: (agent: Agent) => void;
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

export default function AgentDirectoryCard({ agent, onViewProfile, onMessage }: Props) {
  const rawName =
    [agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Agent";
  const fullName = titleCase(rawName);

  const brokerage = agent.company || agent.office_name || "Licensed Agent";
  const teamName = agent.team_name || "";
  const phone = agent.cell_phone || agent.phone || "";

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-5">
        {/* Big avatar */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-zinc-600">
              {initials}
            </div>
          )}
        </div>

        {/* Text block */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-zinc-900">
            {fullName}
          </div>

          <div className="mt-1 truncate text-sm text-zinc-600">{brokerage}</div>

          {teamName ? (
            <div className="mt-1 truncate text-sm text-zinc-500">{teamName}</div>
          ) : null}

          {/* Contact line (no pills) */}
          <div className="mt-4 flex items-center gap-3 text-sm text-zinc-600">
            {phone ? (
              <a href={`tel:${phone}`} className="hover:text-zinc-900">
                {phone}
              </a>
            ) : (
              <span className="text-zinc-500">Contact via message</span>
            )}

            <span className="text-zinc-300">•</span>

            <button
              type="button"
              onClick={() => onMessage?.(agent)}
              className="text-zinc-700 hover:text-zinc-900"
            >
              Message
            </button>
          </div>
        </div>
      </div>

      {/* Single dominant action */}
      <button
        type="button"
        onClick={() => onViewProfile?.(agent.id)}
        className="mt-6 w-full rounded-full bg-zinc-900 py-3 text-sm font-medium text-white hover:opacity-95"
      >
        View profile
      </button>
    </div>
  );
}
