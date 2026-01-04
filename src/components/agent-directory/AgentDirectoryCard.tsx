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
  showEmail?: boolean; // keep false for public
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

export default function AgentDirectoryCard({
  agent,
  onViewProfile,
  onMessage,
  showEmail = false,
}: Props) {
  const rawName =
    [agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Agent";
  const fullName = titleCase(rawName);

  const brokerage = agent.company || agent.office_name || "";
  const teamName = agent.team_name || "";
  const phone = agent.cell_phone || agent.phone || "";
  const email = agent.email || "";

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="group rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/70">
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
          <div className="truncate text-[16px] font-semibold leading-5 text-zinc-900">
            {fullName}
          </div>

          {brokerage ? (
            <div className="mt-1 truncate text-sm text-zinc-600">
              {brokerage}
            </div>
          ) : (
            <div className="mt-1 text-sm text-zinc-500">Licensed Agent</div>
          )}

          {teamName ? (
            <div className="mt-0.5 truncate text-sm text-zinc-500">
              {teamName}
            </div>
          ) : null}
        </div>
      </div>

      {/* Contact (premium "pill" row) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center rounded-full border border-zinc-200/70 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            {phone}
          </a>
        ) : (
          <span className="inline-flex items-center rounded-full border border-zinc-200/70 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600">
            Contact via message
          </span>
        )}

        {showEmail && email ? (
          <a
            href={`mailto:${email}`}
            className="inline-flex max-w-full items-center truncate rounded-full border border-zinc-200/70 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            title={email}
          >
            {email}
          </a>
        ) : null}
      </div>

      {/* Actions (premium chips, not a giant black bar) */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onViewProfile?.(agent.id)}
          className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:opacity-95"
        >
          View profile
        </button>

        {!showEmail ? (
          <button
            type="button"
            onClick={() => onMessage?.(agent)}
            className="inline-flex items-center rounded-full border border-zinc-200/70 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Message
          </button>
        ) : null}
      </div>
    </div>
  );
}
