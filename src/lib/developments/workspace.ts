import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DevelopmentRow } from "./types";
import type { DevelopmentMemberRole, DevelopmentPublishStatus } from "./publishStatus";

type DevelopmentUpdate = Database["public"]["Tables"]["developments"]["Update"];
type DevelopmentInsert = Database["public"]["Tables"]["developments"]["Insert"];
type FloorPlanInsert = Database["public"]["Tables"]["development_floor_plans"]["Insert"];
type FloorPlanUpdate = Database["public"]["Tables"]["development_floor_plans"]["Update"];
type UnitInsert = Database["public"]["Tables"]["development_units"]["Insert"];
type UnitUpdate = Database["public"]["Tables"]["development_units"]["Update"];
type DocumentInsert = Database["public"]["Tables"]["development_documents"]["Insert"];
type UpdateInsert = Database["public"]["Tables"]["development_updates"]["Insert"];
type UpdateUpdate = Database["public"]["Tables"]["development_updates"]["Update"];
type MediaInsert = Database["public"]["Tables"]["development_media"]["Insert"];
type MemberInsert = Database["public"]["Tables"]["development_account_members"]["Insert"];
type MemberRow = Database["public"]["Tables"]["development_account_members"]["Row"];
type AccountRow = Database["public"]["Tables"]["development_accounts"]["Row"];
type PhaseRow = Database["public"]["Tables"]["development_buildings_phases"]["Row"];
type FloorPlanRow = Database["public"]["Tables"]["development_floor_plans"]["Row"];
type UnitRow = Database["public"]["Tables"]["development_units"]["Row"];
type DocumentRow = Database["public"]["Tables"]["development_documents"]["Row"];
type UpdateRow = Database["public"]["Tables"]["development_updates"]["Row"];
type MediaRow = Database["public"]["Tables"]["development_media"]["Row"];
type SalesContactRow = Database["public"]["Tables"]["development_sales_contacts"]["Row"];

export type DeveloperMembership = MemberRow & {
  account: AccountRow | null;
};

export type DeveloperWorkspaceDevelopment = DevelopmentRow & {
  member_role: DevelopmentMemberRole | null;
  account_name: string | null;
};

const DEVELOPMENT_EDITOR_SELECT = `
  id, account_id, name, slug, stage, sales_status, publish_status, logo_url,
  address, city, state, postal_code, neighborhood, neighborhood_description,
  developer_name, architect_name, interior_designer_name, estimated_completion,
  expected_completion_year, expected_completion_quarter, expected_completion_month,
  actual_completion_date, delivery_from, delivery_to, total_units, total_buildings,
  stories, year_built, construction_type, building_type, building_details,
  building_amenities, amenities_notes, amenities, parking_description, parking_included,
  pet_policy, hoa_fees, hoa_fee_min, hoa_fee_max, hoa_fee_includes, deposit_structure,
  incentives, buyer_agent_compensation, buyer_agent_compensation_notes, description,
  highlights, tier, latitude, longitude, created_at, updated_at, published_at,
  submitted_at, paused_at, archived_at, slug_locked_at, created_by, updated_by,
  published_by
`;

function asError(error: { message: string } | null): string | null {
  return error?.message ?? null;
}

/** Memberships for the signed-in user (RLS-scoped). */
export async function fetchMyDevelopmentMemberships(): Promise<{
  memberships: DeveloperMembership[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("development_account_members")
    .select("*, account:development_accounts(*)")
    .order("created_at", { ascending: true });

  if (error) return { memberships: [], error: error.message };

  const memberships = ((data ?? []) as Array<MemberRow & { account: AccountRow | null }>).map(
    (row) => ({
      ...row,
      account: row.account ?? null,
    }),
  );

  return { memberships, error: null };
}

/** Developments visible to the member (any publish_status) via RLS. */
export async function fetchMyDevelopments(): Promise<{
  developments: DeveloperWorkspaceDevelopment[];
  error: string | null;
}> {
  const [{ memberships, error: memberError }, { data, error }] = await Promise.all([
    fetchMyDevelopmentMemberships(),
    supabase
      .from("developments")
      .select(DEVELOPMENT_EDITOR_SELECT)
      .order("updated_at", { ascending: false }),
  ]);

  if (memberError) return { developments: [], error: memberError };
  if (error) return { developments: [], error: error.message };

  const roleByAccount = new Map(memberships.map((m) => [m.account_id, m.role as DevelopmentMemberRole]));
  const nameByAccount = new Map(memberships.map((m) => [m.account_id, m.account?.name ?? null]));

  const developments = ((data ?? []) as DevelopmentRow[]).map((d) => ({
    ...d,
    member_role: roleByAccount.get(d.account_id) ?? null,
    account_name: nameByAccount.get(d.account_id) ?? null,
  }));

  return { developments, error: null };
}

export async function fetchDevelopmentForWorkspace(developmentId: string): Promise<{
  development: DevelopmentRow | null;
  phases: PhaseRow[];
  floorPlans: FloorPlanRow[];
  units: UnitRow[];
  documents: DocumentRow[];
  updates: UpdateRow[];
  media: MediaRow[];
  salesContacts: SalesContactRow[];
  members: MemberRow[];
  error: string | null;
}> {
  const empty = {
    development: null,
    phases: [] as PhaseRow[],
    floorPlans: [] as FloorPlanRow[],
    units: [] as UnitRow[],
    documents: [] as DocumentRow[],
    updates: [] as UpdateRow[],
    media: [] as MediaRow[],
    salesContacts: [] as SalesContactRow[],
    members: [] as MemberRow[],
    error: null as string | null,
  };

  const { data: development, error } = await supabase
    .from("developments")
    .select(DEVELOPMENT_EDITOR_SELECT)
    .eq("id", developmentId)
    .maybeSingle();

  if (error) return { ...empty, error: error.message };
  if (!development) return { ...empty, error: null };

  const accountId = development.account_id;

  const [
    phasesRes,
    floorPlansRes,
    unitsRes,
    documentsRes,
    updatesRes,
    mediaRes,
    contactsRes,
    membersRes,
  ] = await Promise.all([
    supabase
      .from("development_buildings_phases")
      .select("*")
      .eq("development_id", developmentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_floor_plans")
      .select("*")
      .eq("development_id", developmentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_units")
      .select("*")
      .eq("development_id", developmentId)
      .order("sort_order", { ascending: true })
      .order("unit_number", { ascending: true }),
    supabase
      .from("development_documents")
      .select("*")
      .eq("development_id", developmentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_updates")
      .select("*")
      .eq("development_id", developmentId)
      .order("posted_at", { ascending: false }),
    supabase
      .from("development_media")
      .select("*")
      .eq("development_id", developmentId)
      .is("update_id", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("development_sales_contacts")
      .select("*")
      .eq("development_id", developmentId)
      .order("sort_order", { ascending: true }),
    supabase.from("development_account_members").select("*").eq("account_id", accountId),
  ]);

  const firstError =
    asError(phasesRes.error) ||
    asError(floorPlansRes.error) ||
    asError(unitsRes.error) ||
    asError(documentsRes.error) ||
    asError(updatesRes.error) ||
    asError(mediaRes.error) ||
    asError(contactsRes.error) ||
    asError(membersRes.error);

  return {
    development: development as DevelopmentRow,
    phases: (phasesRes.data ?? []) as PhaseRow[],
    floorPlans: (floorPlansRes.data ?? []) as FloorPlanRow[],
    units: (unitsRes.data ?? []) as UnitRow[],
    documents: (documentsRes.data ?? []) as DocumentRow[],
    updates: (updatesRes.data ?? []) as UpdateRow[],
    media: (mediaRes.data ?? []) as MediaRow[],
    salesContacts: (contactsRes.data ?? []) as SalesContactRow[],
    members: (membersRes.data ?? []) as MemberRow[],
    error: firstError,
  };
}

/** Admin queue: all developments (RLS grants admin SELECT). */
export async function fetchAdminDevelopments(filter?: {
  publishStatus?: DevelopmentPublishStatus | "all";
}): Promise<{ developments: DevelopmentRow[]; error: string | null }> {
  let query = supabase
    .from("developments")
    .select(DEVELOPMENT_EDITOR_SELECT)
    .order("updated_at", { ascending: false });

  if (filter?.publishStatus && filter.publishStatus !== "all") {
    query = query.eq("publish_status", filter.publishStatus);
  }

  const { data, error } = await query;
  if (error) return { developments: [], error: error.message };
  return { developments: (data ?? []) as DevelopmentRow[], error: null };
}

export async function createDevelopment(input: {
  accountId: string;
  name: string;
  slug: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  developerName?: string | null;
}): Promise<{ development: DevelopmentRow | null; error: string | null }> {
  const payload: DevelopmentInsert = {
    account_id: input.accountId,
    name: input.name.trim(),
    slug: input.slug.trim(),
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postalCode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    developer_name: input.developerName ?? null,
  };

  const { data, error } = await supabase
    .from("developments")
    .insert(payload)
    .select(DEVELOPMENT_EDITOR_SELECT)
    .maybeSingle();

  if (error) return { development: null, error: error.message };
  return { development: data as DevelopmentRow, error: null };
}

export async function updateDevelopmentDetails(
  developmentId: string,
  patch: DevelopmentUpdate,
): Promise<{ development: DevelopmentRow | null; error: string | null }> {
  // Never attempt to write admin_notes or account_id from this path.
  const {
    admin_notes: _adminNotes,
    account_id: _accountId,
    published_at: _publishedAt,
    published_by: _publishedBy,
    submitted_at: _submittedAt,
    paused_at: _pausedAt,
    archived_at: _archivedAt,
    slug_locked_at: _slugLocked,
    ...safePatch
  } = patch;

  const { data, error } = await supabase
    .from("developments")
    .update(safePatch)
    .eq("id", developmentId)
    .select(DEVELOPMENT_EDITOR_SELECT)
    .maybeSingle();

  if (error) return { development: null, error: error.message };
  return { development: data as DevelopmentRow, error: null };
}

export async function setDevelopmentPublishStatus(
  developmentId: string,
  publishStatus: DevelopmentPublishStatus,
): Promise<{ development: DevelopmentRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("developments")
    .update({ publish_status: publishStatus })
    .eq("id", developmentId)
    .select(DEVELOPMENT_EDITOR_SELECT)
    .maybeSingle();

  if (error) return { development: null, error: error.message };
  return { development: data as DevelopmentRow, error: null };
}

export async function upsertFloorPlan(
  payload: FloorPlanInsert | (FloorPlanUpdate & { id: string }),
): Promise<{ error: string | null }> {
  if ("id" in payload && payload.id) {
    const { id, ...patch } = payload;
    const { error } = await supabase.from("development_floor_plans").update(patch).eq("id", id);
    return { error: asError(error) };
  }
  const { error } = await supabase.from("development_floor_plans").insert(payload as FloorPlanInsert);
  return { error: asError(error) };
}

export async function deleteFloorPlan(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_floor_plans").delete().eq("id", id);
  return { error: asError(error) };
}

export async function upsertUnit(
  payload: UnitInsert | (UnitUpdate & { id: string }),
): Promise<{ error: string | null }> {
  if ("id" in payload && payload.id) {
    const { id, ...patch } = payload;
    const { error } = await supabase.from("development_units").update(patch).eq("id", id);
    return { error: asError(error) };
  }
  const { error } = await supabase.from("development_units").insert(payload as UnitInsert);
  return { error: asError(error) };
}

export async function deleteUnit(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_units").delete().eq("id", id);
  return { error: asError(error) };
}

export async function createDocument(payload: DocumentInsert): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_documents").insert(payload);
  return { error: asError(error) };
}

export async function deleteDocument(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_documents").delete().eq("id", id);
  return { error: asError(error) };
}

export async function upsertUpdate(
  payload: UpdateInsert | (UpdateUpdate & { id: string }),
): Promise<{ error: string | null }> {
  if ("id" in payload && payload.id) {
    const { id, ...patch } = payload;
    const { error } = await supabase.from("development_updates").update(patch).eq("id", id);
    return { error: asError(error) };
  }
  const { error } = await supabase.from("development_updates").insert(payload as UpdateInsert);
  return { error: asError(error) };
}

export async function deleteUpdate(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_updates").delete().eq("id", id);
  return { error: asError(error) };
}

export async function createMediaRow(payload: MediaInsert): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_media").insert(payload);
  return { error: asError(error) };
}

export async function deleteMediaRow(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_media").delete().eq("id", id);
  return { error: asError(error) };
}

export async function setMediaHero(developmentId: string, mediaId: string): Promise<{ error: string | null }> {
  const clear = await supabase
    .from("development_media")
    .update({ is_hero: false })
    .eq("development_id", developmentId)
    .eq("is_hero", true);
  if (clear.error) return { error: clear.error.message };

  const { error } = await supabase.from("development_media").update({ is_hero: true }).eq("id", mediaId);
  return { error: asError(error) };
}

export async function uploadDevelopmentMediaFile(options: {
  developmentId: string;
  accountId: string;
  file: File;
  kind?: string;
  isHero?: boolean;
}): Promise<{ error: string | null }> {
  const ext = options.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${options.developmentId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("development-media")
    .upload(path, options.file, { contentType: options.file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  return createMediaRow({
    development_id: options.developmentId,
    account_id: options.accountId,
    source_type: "storage",
    storage_path: path,
    kind: options.kind ?? "photo",
    is_hero: options.isHero ?? false,
    sort_order: 0,
  });
}

export async function uploadDevelopmentDocumentFile(options: {
  developmentId: string;
  accountId: string;
  file: File;
  title: string;
  category: string;
  access?: string;
}): Promise<{ error: string | null }> {
  const ext = options.file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${options.developmentId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("development-documents")
    .upload(path, options.file, { contentType: options.file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  return createDocument({
    development_id: options.developmentId,
    account_id: options.accountId,
    title: options.title,
    category: options.category,
    access: options.access ?? "agent_only",
    storage_path: path,
    sort_order: 0,
  });
}

export async function addAccountMember(payload: MemberInsert): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_account_members").insert(payload);
  return { error: asError(error) };
}

export async function updateAccountMemberRole(
  memberId: string,
  role: DevelopmentMemberRole,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("development_account_members")
    .update({ role })
    .eq("id", memberId);
  return { error: asError(error) };
}

export async function removeAccountMember(memberId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_account_members").delete().eq("id", memberId);
  return { error: asError(error) };
}

type SalesContactInsert = Database["public"]["Tables"]["development_sales_contacts"]["Insert"];
type SalesContactUpdate = Database["public"]["Tables"]["development_sales_contacts"]["Update"];

export async function upsertSalesContact(
  payload: SalesContactInsert | (SalesContactUpdate & { id: string }),
): Promise<{ error: string | null }> {
  if ("id" in payload && payload.id) {
    const { id, ...patch } = payload;
    const { error } = await supabase.from("development_sales_contacts").update(patch).eq("id", id);
    return { error: asError(error) };
  }
  const { error } = await supabase
    .from("development_sales_contacts")
    .insert(payload as SalesContactInsert);
  return { error: asError(error) };
}

export async function deleteSalesContact(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("development_sales_contacts").delete().eq("id", id);
  return { error: asError(error) };
}

export async function adminSetDevelopmentNotes(
  developmentId: string,
  notes: string,
): Promise<{ notes: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_set_development_admin_notes", {
    _development_id: developmentId,
    _notes: notes,
  });
  if (error) return { notes: null, error: error.message };
  return { notes: (data as string) ?? "", error: null };
}

export async function adminGetDevelopmentNotes(
  developmentId: string,
): Promise<{ notes: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_get_development_admin_notes", {
    _development_id: developmentId,
  });
  if (error) return { notes: null, error: error.message };
  return { notes: (data as string) ?? "", error: null };
}

export async function adminCreateDevelopmentAccount(input: {
  name: string;
  slug: string;
  ownerUserId: string;
  legalName?: string | null;
  billingEmail?: string | null;
}): Promise<{ accountId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_development_account", {
    _name: input.name,
    _slug: input.slug,
    _owner_user_id: input.ownerUserId,
    _legal_name: input.legalName ?? undefined,
    _billing_email: input.billingEmail ?? undefined,
  });
  if (error) return { accountId: null, error: error.message };
  return { accountId: (data as string) ?? null, error: null };
}
