import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdminRole } from "@/lib/auth/roles";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserX, Search, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

interface ConsumerRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  client_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
}

export default function AdminConsumers() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<ConsumerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<ConsumerRow | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin gate
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { setIsChecking(false); return; }
      const ok = await checkIsAdminRole(userId);
      setIsAdmin(ok);
      setIsChecking(false);
    })();
  }, []);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchPage = useCallback(async (pageIndex: number, searchTerm: string) => {
    setLoading(true);
    try {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let buyerIds: string[];
      let count: number | null;

      if (searchTerm) {
        // Server-side search: find matching profiles first, then intersect with buyer roles
        const { data: matchingProfiles, error: profSearchErr } = await supabase
          .from("profiles")
          .select("id")
          .or(`email.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);

        if (profSearchErr) throw profSearchErr;

        const matchingIds = (matchingProfiles ?? []).map((p: any) => p.id);
        if (matchingIds.length === 0) {
          setRows([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        // Get buyer roles intersected with matching profile IDs
        const { data: roles, count: roleCount, error: rolesErr } = await supabase
          .from("user_roles")
          .select("user_id", { count: "exact" })
          .eq("role", "buyer")
          .in("user_id", matchingIds)
          .range(from, to);

        if (rolesErr) throw rolesErr;
        count = roleCount;
        buyerIds = (roles ?? []).map((r: any) => r.user_id);
      } else {
        // No search: original flow — get paged buyer roles
        const { data: roles, count: roleCount, error: rolesErr } = await supabase
          .from("user_roles")
          .select("user_id", { count: "exact" })
          .eq("role", "buyer")
          .range(from, to);

        if (rolesErr) throw rolesErr;
        count = roleCount;
        buyerIds = (roles ?? []).map((r: any) => r.user_id);
      }

      setTotalCount(count ?? 0);

      if (buyerIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2. Profiles
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id,email,first_name,last_name,created_at")
        .in("id", buyerIds);

      if (profErr) throw profErr;

      const emails = (profiles ?? [])
        .map((p: any) => p.email)
        .filter(Boolean)
        .map((e: string) => e.toLowerCase());

      // 3. Client records by email
      let clientByEmail: Record<string, string> = {};
      if (emails.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id,email")
          .in("email", emails);

        (clients ?? []).forEach((c: any) => {
          if (c.email) clientByEmail[c.email.toLowerCase()] = c.id;
        });
      }

      // 4. Active relationships by client_id
      const clientIds = Object.values(clientByEmail);
      let relByClientId: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: rels } = await supabase
          .from("client_agent_relationships")
          .select("client_id,agent_id")
          .in("client_id", clientIds)
          .eq("status", "active");

        (rels ?? []).forEach((r: any) => {
          relByClientId[r.client_id] = r.agent_id;
        });
      }

      // 5. Agent profiles
      const agentIds = [...new Set(Object.values(relByClientId))];
      let agentById: Record<string, { first_name: string; last_name: string; email: string }> = {};
      if (agentIds.length > 0) {
        const { data: agentProfiles } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,email")
          .in("id", agentIds);

        (agentProfiles ?? []).forEach((a: any) => {
          agentById[a.id] = { first_name: a.first_name, last_name: a.last_name, email: a.email };
        });
      }

      // Merge
      const merged: ConsumerRow[] = (profiles ?? []).map((p: any) => {
        const emailKey = (p.email ?? "").toLowerCase();
        const clientId = clientByEmail[emailKey] ?? null;
        const agentId = clientId ? (relByClientId[clientId] ?? null) : null;
        const agent = agentId ? agentById[agentId] : null;
        return {
          id: p.id,
          email: p.email ?? "",
          first_name: p.first_name,
          last_name: p.last_name,
          created_at: p.created_at,
          client_id: clientId,
          agent_name: agent ? `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim() : null,
          agent_email: agent ? agent.email : null,
        };
      });

      setRows(merged);
    } catch (err: any) {
      console.error("[AdminConsumers] fetch error:", err);
      toast.error(err?.message ?? "Failed to load consumers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchPage(page, debouncedSearch);
  }, [isAdmin, page, debouncedSearch, fetchPage]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleDeactivate = async (user: ConsumerRow) => {
    setDeletingId(user.id);
    setConfirmUser(null);
    try {
      // Step 1: Delete auth user FIRST — if this fails, don't proceed
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("delete-users", {
        body: user.email ? { emails: [user.email] } : { userIds: [user.id] },
      });
      if (fnErr) throw fnErr;
      if (!fnData || fnData.success !== true) {
        throw new Error(fnData?.error || "Auth account removal failed");
      }

      // Step 2: Only soft-deactivate after auth is confirmed deleted
      const { error: rpcErr } = await supabase.rpc("admin_deactivate_buyer" as any, {
        p_user_id: user.id,
      });
      if (rpcErr) throw rpcErr;

      toast.success(`${user.email} deactivated`);
      fetchPage(page, debouncedSearch);
    } catch (err: any) {
      console.error("[AdminConsumers] deactivate error:", err);
      toast.error(err?.message ?? "Failed to deactivate buyer");
    } finally {
      setDeletingId(null);
    }
  };

  if (isChecking) return <LoadingScreen />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center pt-20">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm mb-6">Admin access required.</p>
          <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] pt-20">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Back nav */}
        <div className="mb-4">
          <Link
            to="/admin/approvals"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Link>
        </div>

        <PageHeader
          title="Registered Buyers"
          subtitle={`${totalCount} registered buyers`}
          className="mb-8"
        />

        {/* Search + meta bar */}
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-0 bg-[#FAFAF8] rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <span className="text-sm text-slate-400 ml-auto whitespace-nowrap">
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl border border-gray-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden mb-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              {debouncedSearch ? "No consumers match your search." : "No consumer accounts found."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 font-medium text-slate-500">Name</th>
                  <th className="text-left px-6 py-4 font-medium text-slate-500">Email</th>
                  <th className="text-left px-6 py-4 font-medium text-slate-500">CRM Record</th>
                  <th className="text-left px-6 py-4 font-medium text-slate-500">Active Agent</th>
                  <th className="text-left px-6 py-4 font-medium text-slate-500">Joined</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.email || "—"}</td>
                    <td className="px-6 py-4">
                      {row.client_id ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Client record
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 border-slate-200">
                          Auth only
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {row.agent_name ? (
                        <span>{row.agent_name}</span>
                      ) : (
                        <span className="text-slate-300">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={deletingId === row.id}
                        onClick={() => setConfirmUser(row)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-slate-500">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!confirmUser} onOpenChange={(open) => { if (!open) setConfirmUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Buyer Account</AlertDialogTitle>
            <AlertDialogDescription>
              Disables login and ends relationships for{" "}
              <span className="font-semibold">{confirmUser?.email}</span>.
              Agent CRM contacts are not removed.
              <br /><br />
              <span className="text-red-600 font-medium">The user's auth account will be removed.</span> They may re-register with the same email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmUser && handleDeactivate(confirmUser)}
            >
              Deactivate Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
