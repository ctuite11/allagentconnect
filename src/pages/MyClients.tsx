import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AgentAacPage } from "@/components/layout/AgentAacPage";
import { AgentPageHeader } from "@/components/layout/AgentPageHeader";
import { AgentSectionCard } from "@/components/layout/AgentSectionCard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit, ListPlus, Mail, Phone, User, ArrowUpDown, Download, Send, Upload, Check, UserX, UserPlus, Crown } from "lucide-react";
import ContactQuickActions from "@/components/ContactQuickActions";
import { toast } from "sonner";
import { z } from "zod";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { BulkEmailDialog } from "@/components/BulkEmailDialog";
import { EmailAnalyticsDialog } from "@/components/EmailAnalyticsDialog";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";
import { fetchAllAgentContacts, contactDisplayName, matchesContactQuery, scoreContactSearchMatch } from "@/lib/contactSearch";
import ContactDetailDrawer from "@/components/ContactDetailDrawer";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/Seo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/auth/roles";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  MyContactsStatsStrip,
  readLastContactsImport,
  writeLastContactsImport,
} from "@/components/contacts/MyContactsStatsStrip";
import {
  REMOVE_BUYER_BUTTON_LABEL,
  REMOVE_BUYER_DIALOG_BODY,
  REMOVE_BUYER_DIALOG_TITLE,
  removeBuyer,
} from "@/lib/removeBuyer";

// Helper function for title case display (safe transform, doesn't modify stored data)
const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const MY_CONTACTS_SUBTITLE =
  "Build your contact network to share listings, Hot Sheets, market updates, and stay connected with clients and colleagues.";

const MY_CONTACTS_EMPTY_VALUE =
  "Add contacts one at a time or import your existing database to quickly share listings, Hot Sheets, and market updates.";

// Null-safe helpers used by contact sort/autocomplete on /my-clients.
// Search matching lives in @/lib/contactSearch (shared with share pickers, hot sheets, etc.).

const clientSchema = z.object({
  first_name: z.string().trim().min(2, "First name must be at least 2 characters").max(100),
  last_name: z.string().trim().min(2, "Last name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(20).optional(),
  client_type: z.enum(['buyer', 'seller', 'renter', 'agent', 'lender', 'attorney', 'inspector', 'other']).optional(),
});

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_type: string | null;
  source?: string | null;
  agent_user_id?: string | null;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
  relationship_status?: "active" | "ended" | "none";
  relationship_ended_at?: string | null;
  relationship_created_at?: string | null;
  relationship_user_id?: string | null;
}

const MyClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  /** True when the last fetch failed and left no cached rows (avoids showing empty state on error). */
  const [clientsLoadError, setClientsLoadError] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    client_type: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hotSheetClientId, setHotSheetClientId] = useState<string | null>(null);
  const [hotSheetClientName, setHotSheetClientName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "created_at" | "updated_at">("name");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Contact detail drawer state
  const [drawerClient, setDrawerClient] = useState<Client | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Bulk remove confirmation
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false);
  const [removingBulk, setRemovingBulk] = useState(false);
  
  // Bulk hot sheet state
  const [bulkHotSheetDialogOpen, setBulkHotSheetDialogOpen] = useState(false);
  
  // End relationship state
  const [endRelClient, setEndRelClient] = useState<Client | null>(null);
  const [endingRelationship, setEndingRelationship] = useState(false);

  // Admin-only "Send Founder Invite" row action.
  const [isAdmin, setIsAdmin] = useState(false);
  const [founderInviteClient, setFounderInviteClient] = useState<Client | null>(null);
  const [sendingFounderInvite, setSendingFounderInvite] = useState(false);
  
  // Typeahead autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to manage contacts");
      navigate("/auth");
      return;
    }
    setUser(user);
    setLastImportAt(readLastContactsImport(user.id));
    try {
      const adminFlag = await hasRole(user.id, "admin");
      setIsAdmin(adminFlag);
    } catch {
      setIsAdmin(false);
    }
    fetchClients(user.id);
  };

  const fetchClients = async (userId: string) => {
    try {
      setLoading(true);
      setClientsLoadError(false);
      const unique = await fetchAllAgentContacts<Client>(userId, {
        force: true,
        // Narrow select — full-row `*` on 14k+ CRM rows was timing out for large books.
        select:
          "id, first_name, last_name, email, phone, client_type, created_at, updated_at, relationship_status, relationship_ended_at, relationship_user_id",
      });
      setClients(unique);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast.error(error?.message ? `Failed to load contacts: ${error.message}` : "Failed to load contacts");
      setClientsLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      client_type: "",
    });
    setErrors({});
    setEditingClient(null);
  };

  const handleAddClient = () => {
    resetForm();
    setAddDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setFormData({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone || "",
      client_type: client.client_type || "",
    });
    setEditingClient(client);
    setAddDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = clientSchema.parse(formData);
      setSaving(true);

      if (editingClient) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update({
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            email: validatedData.email,
            phone: validatedData.phone || null,
            client_type: validatedData.client_type || null,
          })
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Client updated successfully");
      } else {
        // Add new client — check for existing duplicate first
        const normalizedEmail = validatedData.email.trim().toLowerCase();

        const { data: existing, error: lookupError } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .eq("agent_id", user.id)
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (lookupError) throw lookupError;

        if (existing) {
          toast.error(
            `A contact with this email already exists: ${existing.first_name} ${existing.last_name}.`
          );
          setSaving(false);
          return;
        }

        // Warn before creating a contact for a buyer who is already actively
        // represented by another AAC agent. The DB trigger blocks downstream
        // relationship inserts; this surfaces the conflict up front.
        {
          const { data: otherAgentRel } = await supabase.rpc(
            "is_buyer_represented_by_other_agent" as any,
            {
              p_email: normalizedEmail,
              p_self_agent_id: user.id,
              p_self_crm_client_id: null,
            }
          );
          const otherAgentRow = Array.isArray(otherAgentRel)
            ? otherAgentRel[0]
            : (otherAgentRel as any);
          if (otherAgentRow && otherAgentRow.agent_id) {
            toast.error(
              "This buyer is already represented by another agent on AAC."
            );
            setSaving(false);
            return;
          }
        }

        const { error } = await supabase
          .from("clients")
          .insert({
            agent_id: user.id,
            agent_user_id: user.id,
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            email: normalizedEmail,
            phone: validatedData.phone || null,
            client_type: validatedData.client_type || null,
          });

        if (error) throw error;
        toast.success("Client added successfully");
      }

      setAddDialogOpen(false);
      resetForm();
      fetchClients(user.id);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        console.error("[MyClients] save client failed", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          raw: error,
        });
        const msg = String(error?.message ?? "");
        if (msg.includes("BUYER_ALREADY_REPRESENTED")) {
          toast.error("This buyer is already represented by another agent on AAC.");
        } else {
          toast.error(error?.message || "Failed to save client");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this client? This will also delete any hot sheets created for them.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);

      if (error) throw error;
      toast.success("Client deleted successfully");
      fetchClients(user.id);
    } catch (error: any) {
      console.error("Error deleting client:", error);
      toast.error("Failed to delete client");
    }
  };

  const handleOpenHotSheetDialog = (client: Client) => {
    setHotSheetClientId(client.id);
    setHotSheetClientName(`${client.first_name} ${client.last_name}`);
  };

  const handleHotSheetSuccess = (hotSheetId: string) => {
    setHotSheetClientId(null);
    setHotSheetClientName("");
    fetchClients(user.id);
    navigate(`/hot-sheets/${hotSheetId}/review`);
  };

  // Toggle favorite handler with optimistic update
  const handleViewFavorites = (client: Client) => {
    // Navigate to the client's hot sheet / favorites page
    navigate(`/my-clients/${client.id}/favorites`);
  };

  // Drawer handlers
  const openContactDrawer = (client: Client) => {
    setDrawerClient(client);
    setDrawerOpen(true);
  };

  const handleDrawerCreateHotSheet = (client: Client) => {
    handleOpenHotSheetDialog(client);
  };

  const handleDrawerEdit = (client: Client) => {
    handleEditClient(client);
  };

  const handleDrawerDelete = (clientId: string) => {
    handleDeleteClient(clientId);
  };

  // Bulk remove handler
  const handleBulkRemove = async () => {
    if (selectedClients.size === 0) return;
    
    setRemovingBulk(true);
    try {
      // First delete from hot_sheet_clients junction table to avoid FK issues
      const clientIds = Array.from(selectedClients);
      
      const { error: junctionError } = await supabase
        .from('hot_sheet_clients' as any)
        .delete()
        .in('client_id', clientIds);
      
      if (junctionError) {
        console.warn("Junction table cleanup warning:", junctionError);
      }
      
      // Now delete the clients
      const { error } = await supabase
        .from("clients")
        .delete()
        .in("id", clientIds);
      
      if (error) throw error;
      
      toast.success(`Removed ${selectedClients.size} contact${selectedClients.size > 1 ? 's' : ''}`);
      setSelectedClients(new Set());
      setBulkRemoveDialogOpen(false);
      fetchClients(user.id);
    } catch (error: any) {
      console.error("Error removing contacts:", error);
      toast.error("Failed to remove contacts");
    } finally {
      setRemovingBulk(false);
    }
  };

  // End relationship handler
  const handleEndRelationship = async () => {
    if (!endRelClient) return;
    setEndingRelationship(true);
    try {
      const result = await removeBuyer({ scope: "agent", crmClientId: endRelClient.id });
      if (!result.ok) return;

      setClients((prev) =>
        prev.map((c) =>
          c.id === endRelClient.id
            ? {
                ...c,
                relationship_status: "ended" as const,
                relationship_ended_at: new Date().toISOString(),
              }
            : c,
        ),
      );

      setEndRelClient(null);
      await fetchClients(user.id);
    } finally {
      setEndingRelationship(false);
    }
  };

  // Bulk hot sheet handler
  const handleBulkCreateHotSheet = () => {
    if (selectedClients.size === 0) {
      toast.error("Please select at least one contact");
      return;
    }
    setBulkHotSheetDialogOpen(true);
  };

  // Reactivate buyer (Contacts → "Add to Buyers")
  const handleAddToBuyers = async (client: Client) => {
    try {
      const { error } = await (supabase as any).rpc("agent_reactivate_buyer", {
        p_crm_client_id: client.id,
      });
      if (error) throw error;
      toast.success(`${toTitleCase(client.first_name)} added to My Buyers`);
      await fetchClients(user.id);
      navigate(`/agent/buyers/${client.id}`);
    } catch (err: any) {
      console.error("[MyClients] Add to Buyers failed", err);
      toast.error(err?.message || "Couldn't add this contact to buyers");
    }
  };

  // Get selected clients for bulk hot sheet
  const getSelectedClientsForHotSheet = () => {
    return clients.filter(client => selectedClients.has(client.id));
  };

  const toggleSelectClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === sortedClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(sortedClients.map(c => c.id)));
    }
  };

  const handleBulkEmail = () => {
    if (selectedClients.size === 0) {
      toast.error("Please select at least one client");
      return;
    }
    setBulkEmailDialogOpen(true);
  };

  const getSelectedClientsForEmail = () => {
    return sortedClients
      .filter((client) => selectedClients.has(client.id))
      .map((client) => ({
        id: client.id,
        email: client.email,
        name: `${client.first_name} ${client.last_name}`.trim(),
      }));
  };

  const handleExportCSV = () => {
    try {
      // Filter out network-sourced contacts from export
      const exportableClients = sortedClients.filter(c => (c as any).source !== 'network');
      
      if (exportableClients.length === 0) {
        toast.info("No exportable contacts found (network contacts are excluded)");
        return;
      }

      // Prepare CSV data
      const headers = ["First Name", "Last Name", "Email", "Phone", "Client Type", "Date Added", "Last Updated"];
      const csvData = exportableClients.map(client => [
        client.first_name,
        client.last_name,
        client.email,
        formatPhoneNumber(client.phone) || "",
        client.client_type || "",
        new Date(client.created_at).toLocaleDateString(),
        new Date(client.updated_at).toLocaleDateString()
      ]);

      // Convert to CSV string
      const csvContent = [
        headers.join(","),
        ...csvData.map(row => 
          row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma or newline
            const cellStr = String(cell).replace(/"/g, '""');
            return cellStr.includes(',') || cellStr.includes('\n') ? `"${cellStr}"` : cellStr;
          }).join(",")
        )
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${exportableClients.length} contacts to CSV`);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export contacts");
    }
  };

  const filteredClients = clients.filter((client) => {
    const searchRaw = searchTerm.trim();
    const matchesSearch = !searchRaw || matchesContactQuery(client, searchRaw);

    // Apply client type filter
    const matchesType = clientTypeFilter === "all" || 
      (clientTypeFilter === "none" && !client.client_type) ||
      client.client_type === clientTypeFilter;

    // Apply relationship filter
    const matchesRelationship = relationshipFilter === "all" ||
      (client.relationship_status || "none") === relationshipFilter;
    
    return matchesSearch && matchesType && matchesRelationship;
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    const q = searchTerm.trim();
    if (q) {
      const scoreDiff = scoreContactSearchMatch(b, q) - scoreContactSearchMatch(a, q);
      if (scoreDiff !== 0) return scoreDiff;
    }

    switch (sortBy) {
      case "name":
        return contactDisplayName(a).localeCompare(contactDisplayName(b));
      case "created_at":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "updated_at":
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      default:
        return 0;
    }
  });

  // Pagination calculations
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(sortedClients.length / itemsPerPage);
  const startIndex = itemsPerPage === -1 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === -1 ? sortedClients.length : startIndex + itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, clientTypeFilter, relationshipFilter, sortBy]);

  const contactStats = useMemo(() => {
    const buyerCount = clients.filter((c) => c.client_type === "buyer").length;
    const agentCount = clients.filter((c) => c.client_type === "agent").length;
    return { totalContacts: clients.length, buyerCount, agentCount };
  }, [clients]);

  if (loading) {
    return (
      <TooltipProvider>
        <Seo
          title="Contacts | All Agent Connect"
          description="Manage clients, contacts, and relationship workflows inside All Agent Connect."
          canonical="https://allagentconnect.com/my-clients"
          noindex
        />
        <AgentAacPage className="pb-12" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading contacts…</span>
          <AgentPageHeader
            withTopPadding
            title="My Contacts"
            subtitle={MY_CONTACTS_SUBTITLE}
          />
          <div className="mb-5 flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32 rounded-lg bg-neutral-100" />
            <Skeleton className="h-9 w-36 rounded-lg bg-neutral-100" />
            <Skeleton className="ml-auto h-9 w-[min(100%,20rem)] rounded-lg bg-neutral-100 md:max-w-md" />
          </div>
          <AgentSectionCard className="overflow-hidden border border-neutral-200 p-0 shadow-sm">
            <div className="border-b border-neutral-100 px-6 py-3">
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5, 6].map((col) => (
                  <Skeleton key={col} className="h-4 flex-1 max-w-[7rem] rounded bg-neutral-100" />
                ))}
              </div>
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
              <div
                key={row}
                className="flex items-center gap-4 border-b border-neutral-50 px-6 py-3 last:border-b-0"
              >
                <Skeleton className="h-9 w-full max-w-xl rounded-md bg-neutral-50" />
              </div>
            ))}
          </AgentSectionCard>
        </AgentAacPage>
      </TooltipProvider>
    );
  }

  if (!loading && clientsLoadError && clients.length === 0 && user) {
    return (
      <TooltipProvider>
        <Seo
          title="Contacts | All Agent Connect"
          description="Manage clients, contacts, and relationship workflows inside All Agent Connect."
          canonical="https://allagentconnect.com/my-clients"
          noindex
        />
        <AgentAacPage className="pb-12">
          <AgentPageHeader
            withTopPadding
            title="My Contacts"
            subtitle={MY_CONTACTS_SUBTITLE}
          />
          <AgentSectionCard className="border border-neutral-200 p-8 shadow-sm">
            <div className="space-y-4 text-center">
              <p className="font-medium text-neutral-900">Couldn&apos;t load contacts</p>
              <p className="text-sm text-neutral-600">
                Check your connection and try again. If the problem continues, refresh the page.
              </p>
              <Button
                size="sm"
                type="button"
                onClick={() => fetchClients(user.id)}
                className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
              >
                Try again
              </Button>
            </div>
          </AgentSectionCard>
        </AgentAacPage>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Seo
        title="Contacts | All Agent Connect"
        description="Manage clients, contacts, and relationship workflows inside All Agent Connect."
        canonical="https://allagentconnect.com/my-clients"
        noindex
      />
      <AgentAacPage className="pb-12">
        <AgentPageHeader
          withTopPadding
          title="My Contacts"
          subtitle={MY_CONTACTS_SUBTITLE}
        />

          {/* Action Buttons - Primary left, utilities right */}
          {/* Action Buttons - Two-row layout: CTAs top, Search/Filters bottom */}
          <div className="mb-4 flex flex-col gap-3">
            {/* Row 1: Primary CTA left, utilities right */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {/* Primary CTA - Add Contact */}
              <Dialog open={addDialogOpen} onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleAddClient}
                  className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent
                className={cn(
                  "flex max-h-[85vh] w-[min(92vw,500px)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-md",
                  "[&_input:focus-visible]:border-neutral-300 [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-zinc-400/30",
                )}
              >
                <DialogHeader className="border-b border-neutral-200 px-6 py-5">
                  <DialogTitle className="text-xl font-semibold text-zinc-900">{editingClient ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                  <DialogDescription className="text-sm text-zinc-500">
                    {editingClient
                      ? "Update contact information"
                      : "Add contacts as you go, or upload a list anytime. Share listings, market updates, and Hot Sheets—all from one place."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="First Name"
                        maxLength={100}
                        className="capitalize"
                      />
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Last Name"
                        maxLength={100}
                        className="capitalize"
                      />
                      {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      maxLength={255}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <FormattedInput
                      id="phone"
                      format="phone"
                      value={formData.phone}
                      onChange={(value) => setFormData({ ...formData, phone: value })}
                      placeholder="5555555555"
                    />
                  </div>

                  <div className="rounded-lg border border-zinc-100 bg-white space-y-2 p-4">
                    <Label htmlFor="client_type" className="text-base font-semibold">
                      Contact Type
                    </Label>
                    <p className="text-sm text-zinc-500">
                      Optional but will come in handy for organizing your contacts
                    </p>
                    <Select
                      value={formData.client_type || undefined}
                      onValueChange={(value) => setFormData({ ...formData, client_type: value })}
                    >
                      <SelectTrigger id="client_type">
                        <SelectValue placeholder="Select contact type..." />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="buyer">Buyer</SelectItem>
                        <SelectItem value="seller">Seller</SelectItem>
                        <SelectItem value="renter">Renter</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="lender">Lender</SelectItem>
                        <SelectItem value="attorney">Attorney</SelectItem>
                        <SelectItem value="inspector">Inspector</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="-mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-neutral-200 bg-white px-6 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={saving}
                      className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                    >
                      {saving ? "Saving..." : editingClient ? "Update" : "Add Contact"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

              {/* Secondary utilities - right side */}
              <div className="flex flex-wrap gap-2">
                {clients.length > 0 && (
                  <>
                    {selectedClients.size > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBulkEmail}
                        className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send Email ({selectedClients.size})
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setAnalyticsDialogOpen(true)}>
                      <Mail className="h-4 w-4 mr-2 text-neutral-600" />
                      Email Analytics
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                      <Download className="h-4 w-4 mr-2 text-neutral-600" />
                      Export CSV
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2 text-neutral-600" />
                  Import CSV
                </Button>
              </div>
            </div>
          </div>

          {clients.length === 0 ? (
            <AgentSectionCard className="border border-neutral-200 p-8 shadow-sm">
              <div className="py-4 text-center">
                <div
                  className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50/70"
                  aria-hidden
                >
                  <User className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-neutral-900">No contacts yet</h3>
                <p className="mb-5 text-sm text-neutral-500">{MY_CONTACTS_EMPTY_VALUE}</p>
                <Button
                  size="sm"
                  onClick={handleAddClient}
                  className="bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Contact
                </Button>
              </div>
            </AgentSectionCard>
          ) : (
            <>
              <MyContactsStatsStrip
                className="mb-4"
                totalContacts={contactStats.totalContacts}
                buyerCount={contactStats.buyerCount}
                agentCount={contactStats.agentCount}
                lastImportAt={lastImportAt}
                activeTypeFilter={clientTypeFilter}
                onFilterAll={() => setClientTypeFilter("all")}
                onFilterBuyers={() => setClientTypeFilter("buyer")}
                onFilterAgents={() => setClientTypeFilter("agent")}
              />
               <AgentSectionCard className="mb-4 overflow-hidden border border-neutral-200 p-0 shadow-sm">
                <div className="space-y-4 p-4 sm:p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                    <div className="relative w-full max-w-[600px]" ref={autocompleteRef}>
                      <Input
                        ref={searchInputRef}
                        placeholder="Search contacts by name, email, phone, or type..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          // Show autocomplete if 2+ chars and there are matches
                          setShowAutocomplete(e.target.value.length >= 2);
                        }}
                        onFocus={() => {
                          if (searchTerm.length >= 2) {
                            setShowAutocomplete(true);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setShowAutocomplete(false);
                          }
                        }}
                        className="pl-10 focus-visible:ring-zinc-400/30"
                      />
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      
                      {/* Typeahead Autocomplete Dropdown */}
                      {showAutocomplete && searchTerm.length >= 2 && sortedClients.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md">
                          <Command className="bg-white">
                            <CommandList>
                              <CommandGroup heading="Quick Jump">
                                {sortedClients.slice(0, 8).map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={contactDisplayName(client)}
                                    onSelect={() => {
                                      setSearchTerm(contactDisplayName(client));
                                      setSelectedClients(new Set([client.id]));
                                      setShowAutocomplete(false);
                                    }}
                                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-50"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium text-zinc-900">
                                        {toTitleCase(contactDisplayName(client))}
                                      </span>
                                      <span className="text-sm text-zinc-500">{client.email}</span>
                                    </div>
                                    {client.client_type && (
                                      <Badge variant="outline" className="text-xs capitalize border-zinc-200 text-zinc-600">
                                        {client.client_type}
                                      </Badge>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                    <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
                      <SelectTrigger className="h-9 w-full min-w-[10rem] border-neutral-200 bg-white sm:w-[168px]">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="buyer">Buyers</SelectItem>
                        <SelectItem value="seller">Sellers</SelectItem>
                        <SelectItem value="renter">Renters</SelectItem>
                        <SelectItem value="agent">Agents</SelectItem>
                        <SelectItem value="lender">Lenders</SelectItem>
                        <SelectItem value="attorney">Attorneys</SelectItem>
                        <SelectItem value="inspector">Inspectors</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="none">No Type Set</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
                      <SelectTrigger className="h-9 w-full min-w-[10rem] border-neutral-200 bg-white sm:w-[168px]">
                        <SelectValue placeholder="Relationship" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="all">All Contacts</SelectItem>
                        <SelectItem value="active">Active Relationships</SelectItem>
                        <SelectItem value="ended">Ended</SelectItem>
                        <SelectItem value="none">No Relationship</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="h-9 w-full min-w-[10rem] border-neutral-200 bg-white sm:w-[188px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="created_at">Date Added</SelectItem>
                        <SelectItem value="updated_at">Last Updated</SelectItem>
                      </SelectContent>
                    </Select>
                    </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 border-t border-neutral-100 pt-3 xl:border-t-0 xl:pt-0">
                      <span className="text-sm text-neutral-600">Per page:</span>
                      <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}>
                        <SelectTrigger className="h-9 w-[76px] border-neutral-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="-1">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {(searchTerm || clientTypeFilter !== "all" || relationshipFilter !== "all") && (
                      <p className="text-sm text-neutral-600">
                        Found {filteredClients.length} of {clients.length} contacts
                      </p>
                    )}
                    <p className="text-sm text-neutral-600">
                      {sortedClients.length === 1 
                        ? "Showing 1 of 1 contact"
                        : `Showing ${startIndex + 1}–${Math.min(endIndex, sortedClients.length)} of ${sortedClients.length} contacts`
                      }
                    </p>
                  </div>
                </div>

              {/* Bulk Action Bar - appears when contacts are selected */}
              {selectedClients.size > 0 && (
                <div className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-sm sm:mx-6">
                  <span className="text-sm font-medium text-neutral-700">
                    {selectedClients.size} contact{selectedClients.size > 1 ? 's' : ''} selected
                  </span>
                  <Separator orientation="vertical" className="h-4 bg-neutral-200" />
                  <Button variant="outline" size="sm" onClick={handleBulkCreateHotSheet}>
                    <ListPlus className="mr-2 h-4 w-4 text-neutral-600" />
                    Create Hot Sheet
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBulkRemoveDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                  <Button variant="ghost" size="sm" className="text-neutral-600" onClick={() => setSelectedClients(new Set())}>
                    Clear selection
                  </Button>
                </div>
              )}

              {filteredClients.length === 0 ? (
                <div className="mx-4 mb-6 rounded-xl border border-neutral-200 bg-white p-10 shadow-sm sm:mx-6">
                  <div className="text-center">
                    <User className="mx-auto mb-4 h-14 w-14 text-neutral-300" />
                    <h3 className="mb-2 text-lg font-semibold text-neutral-900">No contacts found</h3>
                    <p className="mb-6 text-sm text-neutral-600">
                      Try adjusting your search or filters
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("");
                        setClientTypeFilter("all");
                        setRelationshipFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:mx-6">
                  {/* Mobile card list */}
                  <ul className="divide-y divide-neutral-100 md:hidden">
                    {paginatedClients.map((client) => {
                      const isSelected = selectedClients.has(client.id);
                      return (
                        <li key={client.id} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div
                              className="pt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectClient(client.id)}
                                aria-label={`Select ${contactDisplayName(client)}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => openContactDrawer(client)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[14px] font-medium text-neutral-900">
                                  {toTitleCase(client.first_name)} {toTitleCase(client.last_name) || (!client.first_name && !client.last_name ? contactDisplayName(client) : "")}
                                </p>
                                {(client as any).source === 'network' && (
                                  <Badge variant="outline" className="border-neutral-200 bg-neutral-100 text-[10px] text-neutral-700">AAC</Badge>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-neutral-600">
                                <Mail className="h-3 w-3 shrink-0 text-neutral-400" />
                                <span className="truncate">{client.email}</span>
                              </div>
                              {client.phone && (
                                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-neutral-600">
                                  <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
                                  <span>{formatPhoneNumber(client.phone)}</span>
                                </div>
                              )}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {client.client_type && (
                                  <Badge variant="outline" className="border-neutral-200 bg-white text-[10px] capitalize text-neutral-700">
                                    {client.client_type}
                                  </Badge>
                                )}
                                {client.relationship_status === "active" && (
                                  <Badge variant="outline" className="border-neutral-200 bg-neutral-100 text-[10px] text-neutral-800">Active</Badge>
                                )}
                                {client.relationship_status === "ended" && (
                                  <Badge variant="outline" className="border-zinc-200 bg-zinc-100 text-[10px] text-zinc-500">Ended</Badge>
                                )}
                              </div>
                            </button>
                            <div
                              className="flex shrink-0 items-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isAdmin && client.email && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 px-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFounderInviteClient(client);
                                  }}
                                  aria-label="Send Founder Invite"
                                >
                                  <Crown className="h-4 w-4 text-[#22C55E]" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 px-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClient(client);
                                }}
                                aria-label="Edit contact"
                              >
                                <Edit className="h-4 w-4 text-neutral-500" />
                              </Button>
                              <Separator orientation="vertical" className="mx-0.5 h-5 bg-neutral-200" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 px-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClient(client.id);
                                }}
                                aria-label="Remove contact"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader className="border-b border-neutral-100 bg-neutral-50/80">
                      <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className="w-12">
                          {(() => {
                            const allOnPageSelected = paginatedClients.length > 0 && paginatedClients.every(client => selectedClients.has(client.id));
                            const someOnPageSelected = paginatedClients.some(client => selectedClients.has(client.id));
                            const isIndeterminate = someOnPageSelected && !allOnPageSelected;
                            return (
                              <Checkbox
                                checked={isIndeterminate ? "indeterminate" : allOnPageSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    const newSelected = new Set(selectedClients);
                                    paginatedClients.forEach(client => newSelected.add(client.id));
                                    setSelectedClients(newSelected);
                                  } else {
                                    const newSelected = new Set(selectedClients);
                                    paginatedClients.forEach(client => newSelected.delete(client.id));
                                    setSelectedClients(newSelected);
                                  }
                                }}
                              />
                            );
                          })()}
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Client Type</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClients.map((client) => (
                    <TableRow 
                      key={client.id} 
                      className="cursor-pointer transition-colors hover:bg-neutral-50/90 focus-within:bg-neutral-50/90"
                      onClick={() => openContactDrawer(client)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={() => toggleSelectClient(client.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {toTitleCase(client.first_name)} {toTitleCase(client.last_name)}
                        {(client as any).source === 'network' && (
                          <Badge variant="outline" className="ml-2 border-neutral-200 bg-neutral-100 text-[10px] text-neutral-700">AAC Member</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 shrink-0 text-neutral-400" />
                            {client.email}
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                              <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
                              {formatPhoneNumber(client.phone)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-zinc-900 truncate capitalize">
                          {client.client_type || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {client.relationship_status === "active" && (
                          <Badge variant="outline" className="border-neutral-200 bg-neutral-100 text-[10px] text-neutral-800">Active</Badge>
                        )}
                        {client.relationship_status === "ended" && (
                          <Badge variant="outline" className="bg-zinc-100 text-zinc-500 border-zinc-200 text-[10px]">Ended</Badge>
                        )}
                        {(!client.relationship_status || client.relationship_status === "none") && (
                          <span className="text-sm text-neutral-400">No Relationship</span>
                        )}
                      </TableCell>
                       <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end items-center gap-1">
                          <ContactQuickActions
                            client={client}
                            size="sm"
                            onHotSheet={handleOpenHotSheetDialog}
                            onViewFavorites={handleViewFavorites}
                            stopPropagation
                          />
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-2 group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClient(client);
                                }}
                              >
                                <Edit className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-neutral-700" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={8}>
                              <p>Edit Contact</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          {client.relationship_status === "active" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2 group"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEndRelClient(client);
                                  }}
                                >
                                  <UserX className="h-4 w-4 text-zinc-400 group-hover:text-destructive transition-colors" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={8}>
                                <p>{REMOVE_BUYER_BUTTON_LABEL}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {(client.relationship_status === "ended" ||
                            !client.relationship_status ||
                            client.relationship_status === "none") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2 group"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToBuyers(client);
                                  }}
                                >
                                  <UserPlus className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-neutral-700" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={8}>
                                <p>Add to Buyers</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {isAdmin && client.email && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2 group"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFounderInviteClient(client);
                                  }}
                                >
                                  <Crown className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-[#22C55E]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={8}>
                                <p>Send Founder Invite</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          <Separator orientation="vertical" className="mx-0.5 h-5 bg-neutral-200" />

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClient(client.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={8}>
                              <p>Remove Contact</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center border-t border-neutral-100 px-4 pb-4 pt-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {[...Array(totalPages)].map((_, idx) => {
                        const pageNum = idx + 1;
                        // Show first page, last page, current page, and pages around current
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
              </>
              )}
            </AgentSectionCard>
            </>
          )}
      </AgentAacPage>


      {/* Hot Sheet Creation Dialog */}
      <CreateHotSheetDialog
        open={!!hotSheetClientId}
        onOpenChange={(open) => {
          if (!open) {
            setHotSheetClientId(null);
            setHotSheetClientName("");
          }
        }}
        clientId={hotSheetClientId || undefined}
        clientName={hotSheetClientName}
        userId={user?.id}
        onSuccess={handleHotSheetSuccess}
      />

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        open={bulkEmailDialogOpen}
        onOpenChange={(open) => {
          setBulkEmailDialogOpen(open);
          if (!open) {
            setSelectedClients(new Set());
          }
        }}
        recipients={getSelectedClientsForEmail()}
      />

      {/* Email Analytics Dialog */}
      <EmailAnalyticsDialog
        open={analyticsDialogOpen}
        onOpenChange={setAnalyticsDialogOpen}
      />

      {/* Import Clients Dialog */}
      <ImportClientsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        agentId={user?.id || ""}
        onImportComplete={() => {
          if (user) {
            const importedAt = new Date().toISOString();
            writeLastContactsImport(user.id, importedAt);
            setLastImportAt(importedAt);
            fetchClients(user.id);
          }
        }}
      />

      {/* Contact Detail Drawer */}
      <ContactDetailDrawer
        client={drawerClient}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCreateHotSheet={handleDrawerCreateHotSheet}
        onEdit={handleDrawerEdit}
        onDelete={handleDrawerDelete}
        onViewFavorites={handleViewFavorites}
      />

      {/* Bulk Remove Confirmation */}
      <AlertDialog open={bulkRemoveDialogOpen} onOpenChange={setBulkRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedClients.size} contact{selectedClients.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected contacts and any associated hot sheet assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingBulk}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkRemove}
              disabled={removingBulk}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingBulk ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Hot Sheet Dialog */}
      <CreateHotSheetDialog
        open={bulkHotSheetDialogOpen}
        onOpenChange={(open) => {
          setBulkHotSheetDialogOpen(open);
          if (!open) {
            setSelectedClients(new Set());
          }
        }}
        userId={user?.id}
        onSuccess={(hotSheetId) => {
          setBulkHotSheetDialogOpen(false);
          setSelectedClients(new Set());
          fetchClients(user.id);
          navigate(`/hot-sheets/${hotSheetId}/review`);
        }}
        preSelectedClients={getSelectedClientsForHotSheet()}
      />

      {/* End Relationship Confirmation */}
      <AlertDialog open={!!endRelClient} onOpenChange={(open) => { if (!open) setEndRelClient(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{REMOVE_BUYER_DIALOG_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>{REMOVE_BUYER_DIALOG_BODY}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={endingRelationship}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndRelationship}
              disabled={endingRelationship}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {endingRelationship ? "Removing…" : REMOVE_BUYER_BUTTON_LABEL}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin: Send Founder Invite Confirmation */}
      <AlertDialog
        open={!!founderInviteClient}
        onOpenChange={(open) => { if (!open) setFounderInviteClient(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Founder Invite?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends the Founding Partner invitation to{" "}
              <span className="font-medium text-foreground">
                {founderInviteClient
                  ? `${toTitleCase(founderInviteClient.first_name)} ${toTitleCase(founderInviteClient.last_name)}`
                  : "this contact"}
              </span>{" "}
              ({founderInviteClient?.email}). It is delivered as a 1:1 transactional-style send and bypasses the bulk pause gate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingFounderInvite}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sendingFounderInvite}
              onClick={async () => {
                if (!founderInviteClient?.email) return;
                setSendingFounderInvite(true);
                try {
                  await invokeEdgeFunction("send-founder-invite", {
                    recipientEmail: founderInviteClient.email,
                    recipientName: `${founderInviteClient.first_name || ""} ${founderInviteClient.last_name || ""}`.trim(),
                  });
                  toast.success(`Founder invite queued for ${founderInviteClient.email}`);
                  setFounderInviteClient(null);
                } catch (e: any) {
                  toast.error(e?.message || "Failed to send founder invite");
                } finally {
                  setSendingFounderInvite(false);
                }
              }}
            >
              {sendingFounderInvite ? "Sending…" : "Send Invite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default MyClients;
