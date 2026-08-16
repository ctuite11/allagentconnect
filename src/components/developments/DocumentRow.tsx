import { useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openDevelopmentDocument } from "@/lib/developments/documentUrl";
import {
  AGENT_RESOURCE_CATEGORIES,
  documentCategoryLabel,
} from "@/lib/developments/format";
import type { DevelopmentDocumentRow } from "@/lib/developments/types";
import { cn } from "@/lib/utils";

export function DocumentRow({ document }: { document: DevelopmentDocumentRow }) {
  const [loading, setLoading] = useState(false);
  const isAgentResource =
    document.is_featured_agent_resource || AGENT_RESOURCE_CATEGORIES.has(document.category);

  const openDocument = async () => {
    setLoading(true);
    const result = await openDevelopmentDocument(document.id);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        isAgentResource
          ? "border-emerald-200/80 bg-emerald-50/40"
          : "border-zinc-200 bg-white",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white p-2 ring-1 ring-zinc-200">
          <FileText className="h-4 w-4 text-zinc-600" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-zinc-900">{document.title}</h3>
            {document.is_featured_agent_resource ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <Star className="h-3 w-3" />
                Agent resource
              </span>
            ) : null}
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {documentCategoryLabel(document.category)}
          </p>
          {document.description ? (
            <p className="text-sm text-zinc-600">{document.description}</p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={loading}
        onClick={() => void openDocument()}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-4 w-4" />
        )}
        Open
        <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-60" />
      </Button>
    </div>
  );
}
