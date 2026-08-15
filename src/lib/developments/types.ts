import type { Database } from "@/integrations/supabase/types";

export type DevelopmentRow = Database["public"]["Tables"]["developments"]["Row"];
export type DevelopmentMediaRow = Database["public"]["Tables"]["development_media"]["Row"];
export type DevelopmentUnitRow = Database["public"]["Tables"]["development_units"]["Row"];
export type DevelopmentFloorPlanRow = Database["public"]["Tables"]["development_floor_plans"]["Row"];
export type DevelopmentDocumentRow = Database["public"]["Tables"]["development_documents"]["Row"];
export type DevelopmentSalesContactRow = Database["public"]["Tables"]["development_sales_contacts"]["Row"];
export type DevelopmentUpdateRow = Database["public"]["Tables"]["development_updates"]["Row"];
export type DevelopmentBuildingPhaseRow = Database["public"]["Tables"]["development_buildings_phases"]["Row"];

export type DevelopmentLifecycleStatus =
  | "coming_soon"
  | "pre_construction"
  | "under_construction"
  | "now_selling"
  | "completed";

export type DevelopmentTier = "standard" | "featured" | "premium";

export type DevelopmentUnitStatus =
  | "available"
  | "reserved"
  | "under_agreement"
  | "sold"
  | "coming_soon";

export type DevelopmentDocumentCategory =
  | "brochure"
  | "floor_plan"
  | "site_plan"
  | "spec_sheet"
  | "finish_package"
  | "disclosure"
  | "condo_docs"
  | "deposit_schedule"
  | "broker_registration"
  | "buyer_agent_compensation"
  | "commission_bonus"
  | "showing_tour_procedure"
  | "sales_office_hours"
  | "offer_submission"
  | "other";

export type DevelopmentBrowseCard = {
  development: DevelopmentRow;
  heroUrl: string | null;
  startingPrice: number | null;
  availableUnitCount: number;
};

export type DevelopmentDetailBundle = {
  development: DevelopmentRow;
  hero: DevelopmentMediaRow | null;
  media: DevelopmentMediaRow[];
  mediaUrls: Record<string, string>;
  phases: DevelopmentBuildingPhaseRow[];
  floorPlans: DevelopmentFloorPlanRow[];
  units: DevelopmentUnitRow[];
  documents: DevelopmentDocumentRow[];
  salesContacts: DevelopmentSalesContactRow[];
  updates: DevelopmentUpdateRow[];
  startingPrice: number | null;
  availableUnitCount: number;
};
