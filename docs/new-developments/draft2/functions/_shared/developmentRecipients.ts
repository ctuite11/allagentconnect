/**
 * Server-side recipient routing for New Developments notifications (DRAFT 2 — not deployed).
 *
 * Three ordered tiers (SSOT §2.6):
 *   1. Active contacts flagged for the channel that have an email
 *   2. The primary active contact, if it has an email
 *   3. The account's owner members
 * Contacts without an email never block routing.
 */
export type NotificationChannel = "leads" | "showings";

export interface DevelopmentRecipient {
  identityKind: "contact" | "owner";
  identityId: string;
  email: string;
  name: string | null;
}

interface MinimalClient {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<any> } };
}

export async function resolveDevelopmentRecipients(
  supabase: MinimalClient,
  developmentId: string,
  accountId: string,
  channel: NotificationChannel,
): Promise<DevelopmentRecipient[]> {
  const flagColumn = channel === "leads" ? "receives_leads" : "receives_showing_requests";

  const { data: contacts, error: contactsError } = await supabase
    .from("development_sales_contacts")
    .select("id, name, email, is_active, is_primary, receives_leads, receives_showing_requests")
    .eq("development_id", developmentId)
    .eq("is_active", true);

  if (contactsError) throw contactsError;

  const withEmail = (contacts ?? []).filter(
    (c: any) => typeof c.email === "string" && c.email.trim().length > 0,
  );

  const tier1 = withEmail.filter((c: any) => c[flagColumn] === true);
  const tier2 = tier1.length === 0 ? withEmail.filter((c: any) => c.is_primary === true) : [];

  const contactRecipients: DevelopmentRecipient[] = [...tier1, ...tier2].map((c: any) => ({
    identityKind: "contact",
    identityId: String(c.id),
    email: String(c.email).trim().toLowerCase(),
    name: c.name ?? null,
  }));

  if (contactRecipients.length > 0) return dedupe(contactRecipients);

  const { data: owners, error: ownersError } = await supabase
    .from("development_account_members")
    .select("user_id")
    .eq("account_id", accountId)
    .eq("role", "owner");

  if (ownersError) throw ownersError;

  const ownerRecipients: DevelopmentRecipient[] = [];
  for (const owner of owners ?? []) {
    const { data, error } = await supabase.auth.admin.getUserById(String(owner.user_id));
    if (error || !data?.user?.email) continue;
    ownerRecipients.push({
      identityKind: "owner",
      identityId: String(owner.user_id),
      email: String(data.user.email).trim().toLowerCase(),
      name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
    });
  }

  return dedupe(ownerRecipients);
}

/** Contact identity wins over owner identity for the same address. */
export function dedupe(recipients: DevelopmentRecipient[]): DevelopmentRecipient[] {
  const byEmail = new Map<string, DevelopmentRecipient>();
  for (const r of recipients) {
    const existing = byEmail.get(r.email);
    if (!existing || (existing.identityKind === "owner" && r.identityKind === "contact")) {
      byEmail.set(r.email, r);
    }
  }
  return [...byEmail.values()];
}
