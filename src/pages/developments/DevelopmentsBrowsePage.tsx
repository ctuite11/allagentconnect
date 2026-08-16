import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AacPageIntro } from "@/components/layout/AacPageIntro";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DevelopmentCard } from "@/components/developments/DevelopmentCard";
import { useDevelopmentBrowse } from "@/hooks/useDevelopments";
import { Building2, RefreshCw } from "lucide-react";

function BrowseSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[420px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

export default function DevelopmentsBrowsePage() {
  const { cards, loading, error, reload } = useDevelopmentBrowse();

  return (
    <AgentAacPage>
      <Seo
        brandType="aac"
        noindex
        title="New Developments"
        description="Browse new construction and development projects available to AAC agents."
      />
      <AacPageIntro
        title="New Developments"
        subtitle="Premium new-construction projects for AAC agents — mini-sites, inventory, and agent resources in one place."
      />

      {loading ? <BrowseSkeleton /> : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-900">Unable to load developments</h2>
          <p className="mt-2 text-sm text-red-800">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-zinc-400" />
          <h2 className="mt-4 font-display text-xl font-semibold text-zinc-900">No published developments yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            When developer partners publish projects, they will appear here as branded mini-sites — not as listing cards.
          </p>
        </div>
      ) : null}

      {!loading && !error && cards.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <DevelopmentCard key={card.development.id} card={card} />
          ))}
        </div>
      ) : null}
    </AgentAacPage>
  );
}
