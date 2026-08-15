import { supabase } from "@/integrations/supabase/client";
import { resolveMediaUrlMap } from "./mediaUrls";
import { isImageCapableKind, isProjectLevelMedia, selectProjectHero } from "./mediaScope";
import type {
  DevelopmentBrowseCard,
  DevelopmentDetailBundle,
  DevelopmentFloorPlanRow,
  DevelopmentMediaRow,
  DevelopmentRow,
  DevelopmentUnitRow,
} from "./types";

const DEVELOPMENT_LIST_SELECT = `
  id, account_id, name, slug, lifecycle_status, publish_status, logo_url,
  address, city, state, postal_code, neighborhood, neighborhood_description,
  developer_name, architect_name, interior_designer_name, estimated_completion,
  delivery_from, delivery_to, total_units, total_buildings, stories, year_built,
  construction_type, building_details, amenities, parking_description, parking_included,
  pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max, hoa_fee_includes, deposit_structure,
  incentives, buyer_agent_compensation, buyer_agent_compensation_notes, description,
  highlights, tier, latitude, longitude, created_at, updated_at, published_at
`;

function minAvailablePrice(units: Array<Pick<DevelopmentUnitRow, "price" | "status">>): number | null {
  const prices = units
    .filter((u) => u.status === "available" && u.price != null)
    .map((u) => Number(u.price))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

function availableCount(units: Array<Pick<DevelopmentUnitRow, "status">>): number {
  return units.filter((u) => u.status === "available").length;
}

function floorPlanStartingPrice(plans: Array<Pick<DevelopmentFloorPlanRow, "price_min" | "is_active">>): number | null {
  const prices = plans
    .filter((p) => p.is_active !== false && p.price_min != null)
    .map((p) => Number(p.price_min))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export async function fetchDevelopmentBrowseCards(): Promise<{
  cards: DevelopmentBrowseCard[];
  error: string | null;
}> {
  const { data: developments, error } = await supabase
    .from("developments")
    .select(DEVELOPMENT_LIST_SELECT)
    .order("tier", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return { cards: [], error: error.message };
  }

  const rows = (developments ?? []) as DevelopmentRow[];
  if (rows.length === 0) return { cards: [], error: null };

  const ids = rows.map((d) => d.id);

  const [{ data: heroes }, { data: units }, { data: floorPlans }] = await Promise.all([
    supabase
      .from("development_media")
      .select(
        "id, development_id, source_type, storage_path, external_url, is_hero, kind, sort_order, floor_plan_id, unit_id, update_id",
      )
      .in("development_id", ids)
      .eq("is_hero", true)
      .is("floor_plan_id", null)
      .is("unit_id", null)
      .is("update_id", null),
    supabase
      .from("development_units")
      .select("development_id, price, status")
      .in("development_id", ids),
    supabase
      .from("development_floor_plans")
      .select("development_id, price_min, is_active")
      .in("development_id", ids),
  ]);

  const heroRows = ((heroes ?? []) as DevelopmentMediaRow[]).filter(
    (m) => isProjectLevelMedia(m) && isImageCapableKind(m.kind),
  );
  const urlMap = await resolveMediaUrlMap(heroRows);
  const heroByDev = new Map(heroRows.map((h) => [h.development_id, h]));

  const unitsByDev = new Map<string, Array<Pick<DevelopmentUnitRow, "price" | "status">>>();
  for (const u of (units ?? []) as Array<Pick<DevelopmentUnitRow, "development_id" | "price" | "status">>) {
    const list = unitsByDev.get(u.development_id) ?? [];
    list.push(u);
    unitsByDev.set(u.development_id, list);
  }

  const plansByDev = new Map<string, Array<Pick<DevelopmentFloorPlanRow, "price_min" | "is_active">>>();
  for (const p of (floorPlans ?? []) as Array<
    Pick<DevelopmentFloorPlanRow, "development_id" | "price_min" | "is_active">
  >) {
    const list = plansByDev.get(p.development_id) ?? [];
    list.push(p);
    plansByDev.set(p.development_id, list);
  }

  const tierRank: Record<string, number> = { premium: 0, featured: 1, standard: 2 };
  const cards: DevelopmentBrowseCard[] = rows
    .slice()
    .sort((a, b) => {
      const tr = (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9);
      if (tr !== 0) return tr;
      return a.name.localeCompare(b.name);
    })
    .map((development) => {
      const hero = heroByDev.get(development.id) ?? null;
      const unitList = unitsByDev.get(development.id) ?? [];
      const planList = plansByDev.get(development.id) ?? [];
      return {
        development,
        heroUrl: hero ? urlMap[hero.id] ?? null : null,
        startingPrice: minAvailablePrice(unitList) ?? floorPlanStartingPrice(planList),
        availableUnitCount: availableCount(unitList),
      };
    });

  return { cards, error: null };
}

export async function fetchDevelopmentBySlug(slug: string): Promise<{
  bundle: DevelopmentDetailBundle | null;
  error: string | null;
}> {
  const normalized = slug.trim();
  if (!normalized) return { bundle: null, error: "Missing development slug." };

  const { data: development, error } = await supabase
    .from("developments")
    .select(DEVELOPMENT_LIST_SELECT)
    .eq("slug", normalized)
    .maybeSingle();

  if (error) return { bundle: null, error: error.message };
  if (!development) return { bundle: null, error: null };

  const id = development.id;

  const [
    mediaRes,
    phasesRes,
    floorPlansRes,
    unitsRes,
    documentsRes,
    contactsRes,
    updatesRes,
  ] = await Promise.all([
    supabase
      .from("development_media")
      .select("*")
      .eq("development_id", id)
      // Phase 1 detail: exclude update-attached media (not shown on update list yet).
      .is("update_id", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_buildings_phases")
      .select("*")
      .eq("development_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_floor_plans")
      .select("*")
      .eq("development_id", id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_units")
      .select("*")
      .eq("development_id", id)
      .order("sort_order", { ascending: true })
      .order("unit_number", { ascending: true }),
    supabase
      .from("development_documents")
      .select("*")
      .eq("development_id", id)
      .order("is_featured_agent_resource", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_sales_contacts")
      .select("*")
      .eq("development_id", id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_updates")
      .select("*")
      .eq("development_id", id)
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("posted_at", { ascending: false }),
  ]);

  const firstError =
    mediaRes.error?.message ||
    phasesRes.error?.message ||
    floorPlansRes.error?.message ||
    unitsRes.error?.message ||
    documentsRes.error?.message ||
    contactsRes.error?.message ||
    updatesRes.error?.message ||
    null;

  if (firstError) return { bundle: null, error: firstError };

  const media = (mediaRes.data ?? []) as DevelopmentMediaRow[];
  const mediaUrls = await resolveMediaUrlMap(media);
  const units = (unitsRes.data ?? []) as DevelopmentUnitRow[];
  const floorPlans = (floorPlansRes.data ?? []) as DevelopmentFloorPlanRow[];
  const hero = selectProjectHero(media);

  return {
    bundle: {
      development: development as DevelopmentRow,
      hero,
      media,
      mediaUrls,
      phases: phasesRes.data ?? [],
      floorPlans,
      units,
      documents: documentsRes.data ?? [],
      salesContacts: contactsRes.data ?? [],
      updates: updatesRes.data ?? [],
      startingPrice: minAvailablePrice(units) ?? floorPlanStartingPrice(floorPlans),
      availableUnitCount: availableCount(units),
    },
    error: null,
  };
}

export function inventoryForFloorPlan(
  units: DevelopmentUnitRow[],
  floorPlanId: string,
): { available: number; total: number; startingPrice: number | null } {
  const related = units.filter((u) => u.floor_plan_id === floorPlanId);
  const availableUnits = related.filter((u) => u.status === "available");
  return {
    available: availableUnits.length,
    total: related.length,
    startingPrice: minAvailablePrice(related),
  };
}
