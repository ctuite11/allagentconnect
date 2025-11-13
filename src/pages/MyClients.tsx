import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit, ListPlus, Mail, Phone, User, ArrowUpDown, Download, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { BulkEmailDialog } from "@/components/BulkEmailDialog";
import { EmailAnalyticsDialog } from "@/components/EmailAnalyticsDialog";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { Checkbox } from "@/components/ui/checkbox";

const clientSchema = z.object({
  first_name: z.string().trim().min(2, "First name must be at least 2 characters").max(100),
  last_name: z.string().trim().min(2, "Last name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
});

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
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
    notes: "",
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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to manage clients");
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
      setClients(data || []);
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
      notes: "",
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
      notes: client.notes || "",
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
            notes: validatedData.notes || null,
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
            notes: validatedData.notes || null,
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
      const headers = ["First Name", "Last Name", "Email", "Phone", "Notes", "Date Added", "Last Updated"];
      const csvData = sortedClients.map(client => [
        client.first_name,
        client.last_name,
        client.email,
        formatPhoneNumber(client.phone) || "",
        client.notes || "",
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
      link.setAttribute("download", `clients_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${sortedClients.length} clients to CSV`);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export clients");
    }
  };

  const filteredClients = clients.filter((client) => {
    const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
    const email = client.email.toLowerCase();
    const phone = client.phone?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    
    return (
      fullName.includes(search) ||
      email.includes(search) ||
      phone.includes(search) ||
      client.notes?.toLowerCase().includes(search)
    );
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading clients...</p>
        </main>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        <Navigation />
      
      <main className="flex-1 bg-muted/30 pt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-4xl font-bold mb-2">My Clients</h1>
                <p className="text-muted-foreground">
                  Manage your clients and create personalized hot sheets for them
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedClients.size > 0 && (
                <Button variant="default" onClick={handleBulkEmail}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email ({selectedClients.size})
                </Button>
              )}
              <Button variant="outline" onClick={() => setAnalyticsDialogOpen(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Email Analytics
              </Button>
              {clients.length > 0 && (
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
              <Dialog open={addDialogOpen} onOpenChange={(open) => {
                setAddDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddClient}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
                  <DialogDescription>
                    {editingClient ? "Update client information" : "Add a new client to your roster"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="John"
                        maxLength={100}
                      />
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Doe"
                        maxLength={100}
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

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes about this client..."
                      rows={3}
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground">{formData.notes.length}/1000</p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : editingClient ? "Update" : "Add Client"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {clients.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No clients yet</h3>
                <p className="text-muted-foreground mb-6">
                  Add your first client to start managing their property search
                </p>
                <Button onClick={handleAddClient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Client
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Search clients by name, email, phone, or notes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-[200px]">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Sort by Name</SelectItem>
                        <SelectItem value="created_at">Sort by Date Added</SelectItem>
                        <SelectItem value="updated_at">Sort by Last Updated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {searchTerm && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Found {filteredClients.length} of {clients.length} clients
                    </p>
                  )}
                </CardContent>
              </Card>

              {filteredClients.length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No clients found</h3>
                    <p className="text-muted-foreground mb-6">
                      Try adjusting your search criteria
                    </p>
                    <Button variant="outline" onClick={() => setSearchTerm("")}>
                      Clear Search
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedClients.size === sortedClients.length && sortedClients.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={() => toggleSelectClient(client.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {client.first_name} {client.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {formatPhoneNumber(client.phone)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {client.notes || "—"}
                        </p>
                      </TableCell>
                       <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleOpenHotSheetDialog(client)}
                              >
                                <ListPlus className="h-4 w-4" />
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
                                onClick={() => handleEditClient(client)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Client</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClient(client.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete Client</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
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

      <Footer />
    </div>
    </TooltipProvider>
  );
};

export default MyClients;
