import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { IncentiveLeadDialog, type IncentiveType } from "./IncentiveLeadDialog";
import { CompareAgentsPanel } from "./CompareAgentsPanel";

interface Props {
  agentId: string;
  agentName: string;
  zip?: string | null;
  listingId?: string | null;
  profileBasePath: string;
  className?: string;
}

const COPY: Record<IncentiveType, { title: string; sub: string; cta: string }> = {
  buyer: {
    title: "Buyer incentives available",
    sub: "This agent offers incentives to buyers who choose to work with them.",
    cta: "Get Buyer Incentive Details",
  },
  seller: {
    title: "Seller incentives available",
    sub: "This agent offers incentives to sellers who choose to work with them.",
    cta: "Get Seller Incentive Details",
  },
};

/** Shows only that incentives exist. Details stay private and are gated behind Name + Email. */
export function IncentiveAvailabilitySection({ agentId, agentName, zip, listingId, profileBasePath, className }: Props) {
  const [avail, setAvail] = useState<{ buyer: boolean; seller: boolean } | null>(null);
  const [leadType, setLeadType] = useState<IncentiveType | null>(null);
  const [compare, setCompare] = useState<IncentiveType | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAvail(null);
    setCompare(null);
    supabase.functions.invoke("dcmls-incentive-availability", { body: { agent_id: agentId } }).then(({ data }) => {
      if (cancelled) return;
      const d = data as { buyer?: boolean; seller?: boolean } | null;
      setAvail({ buyer: d?.buyer === true, seller: d?.seller === true });
    });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (!avail || (!avail.buyer && !avail.seller)) return null;
  const types = (["buyer", "seller"] as IncentiveType[]).filter((t) => avail[t]);

  return (
    <section className={className} aria-label="Agent incentives">
      <div className="grid gap-4 md:grid-cols-2">
        {types.map((t) => (
          <div key={t} className="rounded-lg border border-border bg-card p-5">
            <p className="text-base font-medium text-foreground">{COPY[t].title}</p>
            <p className="mt-1 text-sm italic text-muted-foreground">{COPY[t].sub}</p>
            <Button className="mt-4 w-full sm:w-auto" onClick={() => setLeadType(t)}>{COPY[t].cta}</Button>
            <div>
              <button
                type="button"
                className="mt-3 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setCompare(compare === t ? null : t)}
                aria-expanded={compare === t}
              >
                Compare Agents
              </button>
            </div>
            {compare === t ? (
              <CompareAgentsPanel type={t} excludeAgentId={agentId} initialZip={zip} listingId={listingId} profileBasePath={profileBasePath} />
            ) : null}
          </div>
        ))}
      </div>
      {leadType ? (
        <IncentiveLeadDialog
          open={!!leadType}
          onOpenChange={(o) => !o && setLeadType(null)}
          agentId={agentId}
          agentName={agentName}
          type={leadType}
          zip={zip}
          listingId={listingId}
        />
      ) : null}
    </section>
  );
}
