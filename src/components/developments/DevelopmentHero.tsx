import { MapPin } from "lucide-react";
import type { DevelopmentDetailBundle } from "@/lib/developments/types";
import {
  formatAddressLine,
  formatDateLabel,
  formatLocation,
  formatStartingFrom,
} from "@/lib/developments/format";
import { LifecycleBadge, TierBadge } from "./DevelopmentBadges";

export function DevelopmentHero({ bundle }: { bundle: DevelopmentDetailBundle }) {
  const { development, hero, mediaUrls, startingPrice } = bundle;
  const heroUrl = hero ? mediaUrls[hero.id] ?? null : null;
  const location = formatLocation({
    neighborhood: development.neighborhood,
    city: development.city,
    state: development.state,
  });
  const address = formatAddressLine(development);
  const fromPrice = formatStartingFrom(startingPrice);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-zinc-900 text-white">
      <div className="absolute inset-0">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={hero?.alt || development.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
      </div>

      <div className="relative flex min-h-[min(68vh,560px)] flex-col justify-end p-6 md:p-10 lg:p-12">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TierBadge tier={development.tier} />
          <LifecycleBadge status={development.stage} className="bg-white/15 text-white ring-white/20" />
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            {development.logo_url ? (
              <img
                src={development.logo_url}
                alt=""
                className="h-12 w-auto max-w-[180px] object-contain drop-shadow"
              />
            ) : null}
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              {development.name}
            </h1>
            <p className="flex items-start gap-2 text-sm text-white/85 md:text-base">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/70" aria-hidden />
              <span>
                {location}
                {address && address !== "Address TBD" ? (
                  <span className="mt-1 block text-white/70">{address}</span>
                ) : null}
              </span>
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:min-w-[280px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Developer</dt>
              <dd className="mt-0.5 font-medium">{development.developer_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Architect</dt>
              <dd className="mt-0.5 font-medium">{development.architect_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Est. completion</dt>
              <dd className="mt-0.5 font-medium">{formatDateLabel(development.estimated_completion)}</dd>
            </div>
            {fromPrice ? (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Starting</dt>
                <dd className="mt-0.5 text-lg font-semibold">{fromPrice}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}
