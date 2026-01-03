import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";

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
import { Plus, Trash2, Edit, ListPlus, Mail, Phone, User, ArrowUpDown, Download, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { BulkEmailDialog } from "@/components/BulkEmailDialog";
import { EmailAnalyticsDialog } from "@/components/EmailAnalyticsDialog";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";
import ContactDetailDrawer from "@/components/ContactDetailDrawer";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Checkbox } from "@/components/ui/checkbox";

// Helper function for title case display (safe transform, doesn't modify stored data)
const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
  created_at: string;
  updated_at: string;
}

const MyClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to manage contacts");
      navigate("/auth");
      return;
    }
    setUser(user);
    fetchClients(user.id);
  };

  const fetchClients = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients((data || []) as unknown as Client[]);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
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
        // Add new client
        const { error } = await supabase
          .from("clients")
          .insert({
            agent_id: user.id,
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            email: validatedData.email,
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
        toast.error("Failed to save client");
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

  const handleHotSheetSuccess = () => {
    setHotSheetClientId(null);
    setHotSheetClientName("");
    fetchClients(user.id);
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

  // Bulk hot sheet handler
  const handleBulkCreateHotSheet = () => {
    if (selectedClients.size === 0) {
      toast.error("Please select at least one contact");
      return;
    }
    setBulkHotSheetDialogOpen(true);
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
      .filter(client => selectedClients.has(client.id))
      .map(client => ({
        email: client.email,
        name: `${client.first_name} ${client.last_name}`
      }));
  };

  const handleExportCSV = () => {
    try {
      // Prepare CSV data
      const headers = ["First Name", "Last Name", "Email", "Phone", "Client Type", "Date Added", "Last Updated"];
      const csvData = sortedClients.map(client => [
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

      toast.success(`Exported ${sortedClients.length} contacts to CSV`);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export contacts");
    }
  };

  const filteredClients = clients.filter((client) => {
    const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
    const email = client.email.toLowerCase();
    const phone = client.phone?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    
    // Apply search filter
    const matchesSearch = (
      fullName.includes(search) ||
      email.includes(search) ||
      phone.includes(search) ||
      client.client_type?.toLowerCase().includes(search)
    );

    // Apply client type filter
    const matchesType = clientTypeFilter === "all" || 
      (clientTypeFilter === "none" && !client.client_type) ||
      client.client_type === clientTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    switch (sortBy) {
      case "name":
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
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
  }, [searchTerm, clientTypeFilter, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-20">
          <p className="text-zinc-500">Loading contacts...</p>
        </main>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        <Navigation />
      
      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          <PageHeader
            title="My Contacts"
            subtitle="Manage your contacts and power personalized Hot Sheets, deal alerts, and off-market intelligence."
            className="mb-8"
          />

          {/* Action Buttons */}
          <div className="mb-4 flex gap-2 justify-end flex-wrap">
            {/* Buttons that only show when clients exist */}
            {clients.length > 0 && (
              <>
                {selectedClients.size > 0 && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleBulkEmail}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email ({selectedClients.size})
                  </Button>
                )}
                <Button variant="outline" onClick={() => setAnalyticsDialogOpen(true)}>
                  <Mail className="h-4 w-4 mr-2 text-emerald-600" />
                  Email Analytics
                </Button>
                <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </>
            )}
            
            {/* Import CSV - always visible so users can import their first contacts */}
            <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            
            {/* Add Contact Dialog - always visible */}
            <Dialog open={addDialogOpen} onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddClient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border border-zinc-200 rounded-2xl shadow-lg w-[min(92vw,500px)] max-h-[85vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="px-6 py-5 border-b border-zinc-200">
                  <DialogTitle className="text-xl font-semibold text-zinc-900">{editingClient ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                  <DialogDescription className="text-sm text-zinc-500">
                    {editingClient ? "Update contact information" : "Add a new contact to your roster"}
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

                  <div className="border border-border rounded-lg p-4 bg-muted space-y-2">
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
                      <SelectContent className="bg-background z-50">
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

                  <div className="sticky bottom-0 bg-white border-t border-zinc-200 -mx-6 -mb-5 px-6 py-4 flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {saving ? "Saving..." : editingClient ? "Update" : "Add Contact"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {clients.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-8">
              <div className="text-center py-4">
                  <User className="h-12 w-12 mx-auto mb-3 text-zinc-400" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-1">No contacts yet</h3>
                  <p className="text-sm text-zinc-600 mb-5">
                    Add your first contact to start managing their property search
                  </p>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddClient}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Contact
                  </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-4">
                <div className="p-6">
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Search contacts by name, email, phone, or type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    </div>
                    <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
                      <SelectTrigger className="w-[180px] bg-white border-zinc-200">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
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
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-[200px] bg-white border-zinc-200">
                        <ArrowUpDown className="h-4 w-4 mr-2 text-zinc-400" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="name">Sort by Name</SelectItem>
                        <SelectItem value="created_at">Sort by Date Added</SelectItem>
                        <SelectItem value="updated_at">Sort by Last Updated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {(searchTerm || clientTypeFilter !== "all") && (
                        <p className="text-sm text-zinc-600">
                          Found {filteredClients.length} of {clients.length} contacts
                        </p>
                      )}
                      <p className="text-sm text-zinc-600">
                        {sortedClients.length === 1 
                          ? "Showing 1 of 1 contact"
                          : `Showing ${startIndex + 1}–${Math.min(endIndex, sortedClients.length)} of ${sortedClients.length} contacts`
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-600">Contacts per page:</span>
                      <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}>
                        <SelectTrigger className="w-[100px] bg-white border-zinc-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="-1">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Action Bar - appears when contacts are selected */}
              {selectedClients.size > 0 && (
                <div className="flex items-center gap-3 py-3 px-4 bg-zinc-50 border border-zinc-300 rounded-xl mb-4">
                  <span className="text-sm text-zinc-600 font-medium">
                    {selectedClients.size} contact{selectedClients.size > 1 ? 's' : ''} selected
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <Button variant="outline" size="sm" onClick={handleBulkCreateHotSheet}>
                    <ListPlus className="h-4 w-4 mr-2 text-emerald-600" />
                    Create Hot Sheet
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBulkRemoveDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClients(new Set())}>
                    Clear selection
                  </Button>
                </div>
              )}

              {filteredClients.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-12">
                  <div className="text-center">
                    <User className="h-16 w-16 mx-auto mb-4 text-zinc-400" />
                    <h3 className="text-xl font-semibold text-zinc-900 mb-2">No contacts found</h3>
                    <p className="text-zinc-600 mb-6">
                      Try adjusting your search criteria
                    </p>
                    <Button variant="outline" onClick={() => setSearchTerm("")}>
                      Clear Search
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                <div className="bg-white border border-zinc-200 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                      <TableHead className="w-12">
                          <Checkbox
                            checked={
                              paginatedClients.length > 0 && 
                              paginatedClients.every(client => selectedClients.has(client.id))
                            }
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
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Client Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClients.map((client) => (
                    <TableRow 
                      key={client.id} 
                      className="cursor-pointer hover:bg-zinc-50"
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
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-zinc-400" />
                            {client.email}
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                              <Phone className="h-3 w-3 text-zinc-400" />
                              {formatPhoneNumber(client.phone)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-zinc-500 truncate capitalize">
                          {client.client_type || "—"}
                        </p>
                      </TableCell>
                       <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenHotSheetDialog(client);
                                }}
                              >
                                <ListPlus className="h-4 w-4 text-emerald-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Create Hot Sheet</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClient(client);
                                }}
                              >
                                <Edit className="h-4 w-4 text-zinc-500 group-hover:text-zinc-700" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Contact</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClient(client.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove Contact</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-4">
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
              
              {/* Low-contact helper text */}
              {clients.length > 0 && clients.length <= 3 && (
                <p className="text-sm text-zinc-400 mt-4 text-center">
                  Add contacts to start sending personalized Hot Sheets and private deal alerts.
                </p>
              )}
              </>
              )}
            </>
          )}
        </div>
      </main>

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
        agentId={user?.id}
        onImportComplete={() => {
          if (user) fetchClients(user.id);
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
        onSuccess={() => {
          setBulkHotSheetDialogOpen(false);
          setSelectedClients(new Set());
          fetchClients(user.id);
        }}
        preSelectedClients={getSelectedClientsForHotSheet()}
      />
    </div>
    </TooltipProvider>
  );
};

export default MyClients;
