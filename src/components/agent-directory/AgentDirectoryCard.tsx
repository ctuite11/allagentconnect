import React from "react";

type Agent = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;       // brokerage (preferred)
  office_name?: string | null;   // fallback brokerage
  team_name?: string | null;
  cell_phone?: string | null;
  phone?: string | null;
  email?: string | null;
  headshot_url?: string | null;
};

type Props = {
  agent: Agent;
  onViewProfile?: (id: string) => void;

  // Public-safe contact: opens existing dialog or triggers existing message flow
  onMessage?: (agent: Agent) => void;

  // If you want to show raw email ONLY when authenticated later
  showEmail?: boolean;
};

export default function AgentDirectoryCard({
  agent,
  onViewProfile,
  onMessage,
  showEmail = false,
}: Props) {
  const fullName =
    [agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Agent";

  const brokerage = agent.company || agent.office_name || null;
  const teamName = agent.team_name || null;
  const phone = agent.cell_phone || agent.phone || null;
  const email = agent.email || null;

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {agent.headshot_url ? (
            <img
              src={agent.headshot_url}
              alt={fullName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-600">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-zinc-900">
            {fullName}
          </div>

          {brokerage ? (
            <div className="mt-0.5 truncate text-sm text-zinc-600">
              {brokerage}
            </div>
          ) : null}

          {teamName ? (
            <div className="mt-0.5 truncate text-sm text-zinc-500">
              {teamName}
            </div>
          ) : null}

          <div className="mt-3 space-y-1.5 text-sm">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="block text-zinc-700 hover:text-zinc-900"
              >
                {phone}
              </a>
            ) : null}

            {/* Public-safe: do NOT expose raw email unless showEmail=true */}
            {showEmail && email ? (
              <a
                href={`mailto:${email}`}
                className="block truncate text-zinc-700 hover:text-zinc-900"
                title={email}
              >
                {email}
              </a>
            ) : null}

            {!showEmail ? (
              <button
                type="button"
                onClick={() => onMessage?.(agent)}
                className="block text-left text-zinc-700 hover:text-zinc-900"
              >
                Message
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onViewProfile?.(agent.id)}
        className="mt-4 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-medium text-white hover:opacity-95"
      >
        View profile
      </button>
    </div>
  );
}
