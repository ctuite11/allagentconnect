import { useDevelopmentBundle } from "@/components/developments/DevelopmentLayout";
import { formatDateLabel, markdownToPlainBlocks } from "@/lib/developments/format";

export default function DevelopmentUpdatesPage() {
  const { updates } = useDevelopmentBundle();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">Updates</h2>
        <p className="text-sm text-zinc-600">Construction, sales, design, and general project news.</p>
      </header>

      {updates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600">
          No published updates yet.
        </p>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <article key={update.id} className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <span>{update.kind}</span>
                <span>·</span>
                <time dateTime={update.posted_at}>{formatDateLabel(update.posted_at)}</time>
                {update.is_pinned ? (
                  <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] text-white">Pinned</span>
                ) : null}
              </div>
              <h3 className="mt-2 font-display text-xl font-semibold text-zinc-900">{update.title}</h3>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700">
                {markdownToPlainBlocks(update.body_markdown).map((block, idx) => (
                  <p key={`${update.id}-${idx}`}>{block}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
