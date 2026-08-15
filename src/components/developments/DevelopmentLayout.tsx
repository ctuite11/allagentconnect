import { createContext, useContext, type ReactNode } from "react";
import { Link, Outlet, useOutletContext, useParams } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AacBackLink } from "@/components/layout/AacBackLink";
import { Seo } from "@/components/Seo";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDevelopmentDetail } from "@/hooks/useDevelopments";
import type { DevelopmentDetailBundle } from "@/lib/developments/types";
import { DevelopmentHero } from "./DevelopmentHero";
import { DevelopmentSubNav } from "./DevelopmentSubNav";

type OutletCtx = { bundle: DevelopmentDetailBundle };

const DevelopmentBundleContext = createContext<OutletCtx | null>(null);

export function useDevelopmentBundle(): DevelopmentDetailBundle {
  const fromOutlet = useOutletContext<OutletCtx | null>();
  const fromContext = useContext(DevelopmentBundleContext);
  const bundle = fromOutlet?.bundle ?? fromContext?.bundle;
  if (!bundle) {
    throw new Error("useDevelopmentBundle must be used within DevelopmentLayout");
  }
  return bundle;
}

export function DevelopmentLayout({ children }: { children?: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { bundle, loading, error, notFound, reload } = useDevelopmentDetail(slug);

  if (loading) {
    return (
      <AgentAacPage>
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="mb-6 h-[420px] w-full rounded-2xl" />
        <Skeleton className="h-10 w-full" />
      </AgentAacPage>
    );
  }

  if (error) {
    return (
      <AgentAacPage>
        <AacBackLink to="/developments" aria-label="Back to Developments" />
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">Unable to load development</h1>
          <p className="mt-2 text-sm text-red-800">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      </AgentAacPage>
    );
  }

  if (notFound || !bundle) {
    return (
      <AgentAacPage>
        <AacBackLink to="/developments" aria-label="Back to Developments" />
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-zinc-900">Development not found</h1>
          <p className="mt-2 text-sm text-zinc-600">
            This project may be unpublished, paused, or the link is incorrect.
          </p>
          <Button asChild className="mt-6">
            <Link to="/developments">Browse Developments</Link>
          </Button>
        </div>
      </AgentAacPage>
    );
  }

  const ctx: OutletCtx = { bundle };

  return (
    <DevelopmentBundleContext.Provider value={ctx}>
      <AgentAacPage className="!max-w-6xl">
        <Seo
          brandType="aac"
          noindex
          title={`${bundle.development.name} | New Developments`}
          description={bundle.development.description || `${bundle.development.name} on All Agent Connect.`}
        />
        <div className="mb-4">
          <AacBackLink to="/developments" aria-label="Back to Developments" />
        </div>
        <DevelopmentHero bundle={bundle} />
        <div className="mt-4">
          <DevelopmentSubNav slug={bundle.development.slug} />
        </div>
        <div className="pt-6">{children ?? <Outlet context={ctx} />}</div>
      </AgentAacPage>
    </DevelopmentBundleContext.Provider>
  );
}
