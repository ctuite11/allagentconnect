import { useMemo } from "react";
import { useDevelopmentBundle } from "@/components/developments/DevelopmentLayout";
import { DocumentRow } from "@/components/developments/DocumentRow";
import {
  AGENT_RESOURCE_CATEGORIES,
  documentCategoryLabel,
} from "@/lib/developments/format";

export default function DevelopmentDocumentsPage() {
  const { documents } = useDevelopmentBundle();

  const { featured, rest } = useMemo(() => {
    const featuredDocs = documents.filter(
      (d) => d.is_featured_agent_resource || AGENT_RESOURCE_CATEGORIES.has(d.category),
    );
    const featuredIds = new Set(featuredDocs.map((d) => d.id));
    return {
      featured: featuredDocs,
      rest: documents.filter((d) => !featuredIds.has(d.id)),
    };
  }, [documents]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">Documents</h2>
        <p className="text-sm text-zinc-600">
          Private files open through a 5-minute signed URL. Raw storage paths are never exposed.
        </p>
      </header>

      {documents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600">
          No documents published for this development yet.
        </p>
      ) : (
        <>
          {featured.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                Agent resources
              </h3>
              <p className="text-sm text-zinc-600">
                Broker registration, buyer-agent compensation, commission bonus, showing procedures, deposit
                schedule, offer submission, and related materials.
              </p>
              <div className="space-y-3">
                {featured.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} />
                ))}
              </div>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Marketing & project files
              </h3>
              <div className="space-y-3">
                {rest.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} />
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                Categories include{" "}
                {["brochure", "floor_plan", "site_plan", "disclosure", "condo_docs"]
                  .map((c) => documentCategoryLabel(c))
                  .join(", ")}
                , and more.
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
