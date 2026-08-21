import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DevelopmentBrowseCard } from "@/lib/developments/types";
import {
  formatDateLabel,
  formatLocation,
  formatStartingFrom,
  isElevatedTier,
} from "@/lib/developments/format";
import { formatExpectedCompletion } from "@/lib/developments/contractLabels";
import { LifecycleBadge, TierBadge } from "./DevelopmentBadges";

export function DevelopmentCard({ card }: { card: DevelopmentBrowseCard }) {
  const { development, heroUrl, startingPrice } = card;
  const elevated = isElevatedTier(development.tier);
  const location = formatLocation({
    neighborhood: development.neighborhood,
    city: development.city,
    state: development.state,
  });
  const fromPrice = formatStartingFrom(startingPrice);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-shadow duration-300",
        elevated
          ? "border-zinc-900/15 shadow-[0_12px_40px_rgba(15,23,42,0.12)] ring-1 ring-zinc-900/5"
          : "border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
      )}
    >
      <Link to={`/developments/${development.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-zinc-100">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={development.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-300">
            <span className="text-sm font-medium text-zinc-500">Photography coming soon</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <TierBadge tier={development.tier} />
          <LifecycleBadge status={development.stage} />
        </div>
        {development.logo_url ? (
          <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 p-1.5 shadow-sm ring-1 ring-black/5">
            <img
              src={development.logo_url}
              alt=""
              className="h-9 w-auto max-w-[120px] object-contain"
              loading="lazy"
            />
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
            <Link to={`/developments/${development.slug}`} className="hover:text-aac">
              {development.name}
            </Link>
          </h2>
          <p className="flex items-start gap-1.5 text-sm text-zinc-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
            <span>{location}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Developer</dt>
            <dd className="mt-0.5 text-zinc-800">{development.developer_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Est. completion</dt>
            <dd className="mt-0.5 text-zinc-800">{formatExpectedCompletion(development)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Starting</dt>
            <dd className="mt-0.5 text-base font-semibold text-zinc-900">{fromPrice ?? "Pricing on request"}</dd>
          </div>
        </dl>

        <div className="mt-auto pt-1">
          <Button asChild className="w-full sm:w-auto">
            <Link to={`/developments/${development.slug}`}>
              View Development
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
