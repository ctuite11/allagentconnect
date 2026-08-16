import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDevelopmentBundle } from "@/components/developments/DevelopmentLayout";
import { DevelopmentGalleryPreview } from "@/components/developments/DevelopmentGalleryPreview";
import { FloorPlanCard } from "@/components/developments/FloorPlanCard";
import { DocumentRow } from "@/components/developments/DocumentRow";
import { SalesContactCard } from "@/components/developments/SalesContactCard";
import { UnitStatusBadge } from "@/components/developments/DevelopmentBadges";
import {
  asDetailEntries,
  asStringList,
  formatBedsBaths,
  formatDateLabel,
  formatSqft,
  formatUsd,
  markdownToPlainBlocks,
} from "@/lib/developments/format";
import { floorPlanImageUrl } from "@/lib/developments/mediaScope";
import { parseDevelopmentHash, scheduleDevelopmentSectionScroll } from "@/lib/developments/scroll";
import { Button } from "@/components/ui/button";

function Section({
  id,
  title,
  subtitle,
  children,
  action,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 border-t border-zinc-100 pt-10 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">{title}</h2>
          {subtitle ? <p className="max-w-2xl text-sm text-zinc-600">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DevelopmentOverviewPage() {
  const location = useLocation();
  const bundle = useDevelopmentBundle();
  const { development, media, mediaUrls, floorPlans, units, documents, salesContacts, updates } = bundle;
  const highlights = asStringList(development.highlights);
  const amenities = asStringList(development.amenities);
  const buildingDetails = asDetailEntries(development.building_details);
  const featuredDocs = documents.filter((d) => d.is_featured_agent_resource).slice(0, 4);
  const availableUnits = units.filter((u) => u.status === "available").slice(0, 6);
  const phaseById = new Map(bundle.phases.map((p) => [p.id, p.name]));
  const planById = new Map(floorPlans.map((p) => [p.id, p.name]));

  useEffect(() => {
    const sectionId = parseDevelopmentHash(location.hash);
    if (!sectionId) return;
    return scheduleDevelopmentSectionScroll(sectionId);
  }, [location.hash, location.pathname]);

  return (
    <div className="space-y-2">
      {/* Hero → Photos first — visual experience immediately after branding */}
      <div className="pb-2">
        <DevelopmentGalleryPreview
          developmentName={development.name}
          media={media}
          mediaUrls={mediaUrls}
        />
      </div>

      <Section
        id="overview"
        title="Overview"
        subtitle="Project story, delivery timing, and the details agents need before bringing a buyer."
      >
        {development.description ? (
          <p className="max-w-3xl text-base leading-relaxed text-zinc-700 whitespace-pre-wrap">
            {development.description}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Project description coming soon.</p>
        )}

        {highlights.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {highlights.map((item) => (
              <li key={item} className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-800">
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total units", value: development.total_units != null ? String(development.total_units) : "—" },
            { label: "Stories", value: development.stories != null ? String(development.stories) : "—" },
            { label: "Construction", value: development.construction_type || "—" },
            { label: "Est. completion", value: formatDateLabel(development.estimated_completion) },
            { label: "Delivery window", value: [formatDateLabel(development.delivery_from, ""), formatDateLabel(development.delivery_to, "")].filter(Boolean).join(" – ") || "—" },
            { label: "Interior design", value: development.interior_designer_name || "—" },
            { label: "HOA", value: development.hoa_fees || (development.hoa_fee_min != null ? formatUsd(development.hoa_fee_min) : "—") },
            { label: "Buyer-agent comp", value: development.buyer_agent_compensation || "See documents" },
          ].map((row) => (
            <div key={row.label} className="rounded-xl border border-zinc-200 p-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900">{row.value}</dd>
            </div>
          ))}
        </dl>

        {development.neighborhood_description ? (
          <div className="mt-6 max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Neighborhood</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
              {development.neighborhood_description}
            </p>
          </div>
        ) : null}
      </Section>

      <Section
        id="amenities"
        title="Amenities & building details"
        subtitle="What residents get — and how the building is put together."
      >
        {amenities.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((item) => (
              <li key={item} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Amenities will appear here when provided by the developer.</p>
        )}

        {(buildingDetails.length > 0 ||
          development.parking_description ||
          development.pet_policy ||
          development.incentives ||
          development.deposit_structure) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {buildingDetails.map((row) => (
              <div key={row.label} className="rounded-xl border border-zinc-200 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{row.label}</div>
                <div className="mt-1 text-sm text-zinc-800">{row.value}</div>
              </div>
            ))}
            {development.parking_description ? (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Parking</div>
                <div className="mt-1 text-sm text-zinc-800">{development.parking_description}</div>
              </div>
            ) : null}
            {development.pet_policy ? (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Pet policy</div>
                <div className="mt-1 text-sm text-zinc-800">{development.pet_policy}</div>
              </div>
            ) : null}
            {development.deposit_structure ? (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Deposit schedule</div>
                <div className="mt-1 text-sm text-zinc-800 whitespace-pre-wrap">{development.deposit_structure}</div>
              </div>
            ) : null}
            {development.incentives ? (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Incentives</div>
                <div className="mt-1 text-sm text-zinc-800 whitespace-pre-wrap">{development.incentives}</div>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Section
        title="Floor plans"
        subtitle="Browse residences and jump into matching inventory."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/developments/${development.slug}/floor-plans`}>All floor plans</Link>
          </Button>
        }
      >
        {floorPlans.length === 0 ? (
          <p className="text-sm text-zinc-500">No active floor plans published yet.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {floorPlans.slice(0, 3).map((plan) => (
              <FloorPlanCard
                key={plan.id}
                plan={plan}
                units={units}
                slug={development.slug}
                imageUrl={floorPlanImageUrl(media, mediaUrls, plan.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Available units"
        subtitle="Live inventory from development units — not MLS listings."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/developments/${development.slug}/units`}>View all units</Link>
          </Button>
        }
      >
        {availableUnits.length === 0 ? (
          <p className="text-sm text-zinc-500">No available units at the moment. Check coming soon or reserved inventory on the units page.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Plan</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Beds / baths</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {availableUnits.map((unit) => (
                  <tr key={unit.id} className="border-t border-zinc-100 hover:bg-zinc-50/80">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-aac hover:underline" to={`/developments/${development.slug}/units/${unit.id}`}>
                        {unit.unit_number}
                      </Link>
                      <div className="text-xs text-zinc-500 sm:hidden">
                        {planById.get(unit.floor_plan_id ?? "") || phaseById.get(unit.building_phase_id) || "—"}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-700 sm:table-cell">
                      {planById.get(unit.floor_plan_id ?? "") || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">
                      {formatBedsBaths(unit.beds, unit.baths)}
                      {unit.sqft != null ? ` · ${formatSqft(unit.sqft)}` : ""}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{formatUsd(unit.price)}</td>
                    <td className="px-4 py-3">
                      <UnitStatusBadge status={unit.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Agent resources"
        subtitle="Broker registration, compensation, showing procedures, and more."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/developments/${development.slug}/documents`}>All documents</Link>
          </Button>
        }
      >
        {featuredDocs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Featured agent documents will appear here. Browse the full document library for everything available.
          </p>
        ) : (
          <div className="space-y-3">
            {featuredDocs.map((doc) => (
              <DocumentRow key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Latest updates"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/developments/${development.slug}/updates`}>All updates</Link>
          </Button>
        }
      >
        {updates.length === 0 ? (
          <p className="text-sm text-zinc-500">No published updates yet.</p>
        ) : (
          <div className="space-y-4">
            {updates.slice(0, 3).map((update) => (
              <article key={update.id} className="rounded-2xl border border-zinc-200 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <span>{update.kind}</span>
                  <span>·</span>
                  <time dateTime={update.posted_at}>{formatDateLabel(update.posted_at)}</time>
                  {update.is_pinned ? (
                    <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] text-white">Pinned</span>
                  ) : null}
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-zinc-900">{update.title}</h3>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700">
                  {markdownToPlainBlocks(update.body_markdown).slice(0, 2).map((block) => (
                    <p key={block.slice(0, 24)}>{block}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section id="sales-team" title="Sales team" subtitle="Active sales contacts for this development.">
        {salesContacts.length === 0 ? (
          <p className="text-sm text-zinc-500">Sales contacts will appear here when published.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {salesContacts.map((contact) => (
              <SalesContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
        <p className="pt-2 text-xs text-zinc-500">
          Request Info / Request Showing will be wired after this read experience is solid. Development notification emails remain paused.
        </p>
      </Section>
    </div>
  );
}
