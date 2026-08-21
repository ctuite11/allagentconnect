import type { Database } from "@/integrations/supabase/types";

export type DevelopmentRow = Database["public"]["Tables"]["developments"]["Row"];
export type DevelopmentMediaRow = Database["public"]["Tables"]["development_media"]["Row"];
export type DevelopmentUnitRow = Database["public"]["Tables"]["development_units"]["Row"];
export type DevelopmentFloorPlanRow = Database["public"]["Tables"]["development_floor_plans"]["Row"];
export type DevelopmentDocumentRow = Database["public"]["Tables"]["development_documents"]["Row"];
export type DevelopmentSalesContactRow = Database["public"]["Tables"]["development_sales_contacts"]["Row"];
export type DevelopmentUpdateRow = Database["public"]["Tables"]["development_updates"]["Row"];
export type DevelopmentBuildingPhaseRow = Database["public"]["Tables"]["development_buildings_phases"]["Row"];

/** Physical construction stage only. Marketing states live on sales_status. */
export type DevelopmentStage =
  | "planning"
  | "pre_construction"
  | "under_construction"
  | "completed";

/** @deprecated use DevelopmentStage */
export type DevelopmentLifecycleStatus = DevelopmentStage;

export type DevelopmentSalesStatus =
  | "not_yet_released"
  | "coming_soon"
  | "now_selling"
  | "final_units"
  | "sold_out";

export type DevelopmentTier = "standard" | "featured" | "premium";

export type DevelopmentUnitStatus =
  | "not_released"
  | "coming_soon"
  | "available"
  | "reserved"
  | "under_agreement"
  | "sold";

export type DevelopmentBuildingType =
  | "high_rise"
  | "mid_rise"
  | "low_rise"
  | "garden_style"
  | "three_family"
  | "two_family"
  | "single_family"
  | "townhomes"
  | "condo_community"
  | "loft_conversion"
  | "brownstone"
  | "mixed_use"
  | "other";

export type DevelopmentUnitType =
  | "studio"
  | "flat"
  | "duplex"
  | "triplex"
  | "loft"
  | "penthouse"
  | "townhome"
  | "live_work"
  | "commercial";

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
