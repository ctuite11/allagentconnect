import { useState, useEffect } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Share2, Plus, Trash2, Users, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { HotSheetCommentsDialog } from "@/components/HotSheetCommentsDialog";
import { formatPhoneNumber } from "@/lib/phoneFormat";

interface HotSheet {
  id: string;
  name: string;
  criteria: any;
  is_active: boolean;
  created_at: string;
  shares?: HotSheetShare[];
}

interface HotSheetShare {
  id: string;
  shared_with_email: string;
  created_at: string;
}

const HotSheets = () => {
  const navigate = useNavigate();
  const [hotSheets, setHotSheets] = useState<HotSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState<string | null>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState<string | null>(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHotSheetId, setEditingHotSheetId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to manage hot sheets");
      navigate("/auth");
      return;
    }
    setUser(user);
    fetchHotSheets(user.id);
  };

  const fetchHotSheets = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("hot_sheets")
        .select(`
          id,
          name,
          criteria,
          is_active,
          created_at,
          hot_sheet_shares (
            id,
            shared_with_email,
            created_at
          ),
          hot_sheet_clients (
            client_id,
            clients (
              id,
              first_name,
              last_name,
              email,
              phone
            )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHotSheets((data || []) as any);
    } catch (error: any) {
      console.error("Error fetching hot sheets:", error);
      toast.error("Failed to load hot sheets");
    } finally {
      setLoading(false);
    }
  };

  const handleHotSheetSuccess = (hotSheetId: string) => {
    if (editingHotSheetId) {
      // If editing, just refresh the list
      fetchHotSheets(user.id);
      setEditingHotSheetId(null);
    } else {
      // If creating, navigate to review
      navigate(`/hot-sheets/${hotSheetId}/review`);
    }
  };

  const handleEditSelected = () => {
    if (selectedSheets.size !== 1) {
      toast.error("Please select exactly one hot sheet to edit");
      return;
    }
    const sheetId = Array.from(selectedSheets)[0];
    setEditingHotSheetId(sheetId);
    setEditDialogOpen(true);
  };

  const handleShowResults = () => {
    if (selectedSheets.size !== 1) {
      toast.error("Please select exactly one hot sheet to view");
      return;
    }
    const sheetId = Array.from(selectedSheets)[0];
    navigate(`/hot-sheets/${sheetId}/review`);
  };

  const handleDeleteSelected = async () => {
    if (selectedSheets.size === 0) {
      toast.error("Please select at least one hot sheet to delete");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedSheets.size} hot sheet(s)?`)) {
      return;
    }

    try {
      for (const sheetId of selectedSheets) {
        await supabase
          .from("hot_sheets")
          .delete()
          .eq("id", sheetId);
      }

      toast.success(`Deleted ${selectedSheets.size} hot sheet(s)`);
      setSelectedSheets(new Set());
      fetchHotSheets(user.id);
    } catch (error: any) {
      console.error("Error deleting hot sheets:", error);
      toast.error("Failed to delete hot sheets");
    }
  };

  const handleSendUpdate = async (hotSheetId: string) => {
    try {
      await supabase.functions.invoke("process-hot-sheet", {
        body: {
          hotSheetId,
          sendInitialBatch: true,
        },
      });
      toast.success("Update sent to client");
    } catch (error: any) {
      console.error("Error sending update:", error);
      toast.error("Failed to send update");
    }
  };

  const handleShareHotSheet = async (hotSheetId: string) => {
    if (!friendEmail.trim()) {
      toast.error("Please enter a friend's email");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(friendEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setSharing(true);
      const { error } = await supabase
        .from("hot_sheet_shares")
        .insert({
          hot_sheet_id: hotSheetId,
          shared_with_email: friendEmail.toLowerCase(),
          shared_by_user_id: user.id
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("This hot sheet is already shared with this email");
        } else {
          throw error;
        }
        return;
      }

      // Get hot sheet details and send invite email
      const hotSheet = hotSheets.find(s => s.id === hotSheetId);
      if (hotSheet) {
        try {
          await supabase.functions.invoke("send-hot-sheet-invite", {
            body: {
              invitedEmail: friendEmail.toLowerCase(),
              inviterName: user.email?.split('@')[0] || "A friend",
              hotSheetName: hotSheet.name,
              hotSheetLink: `${window.location.origin}/hot-sheets`,
            },
          });
        } catch (emailError) {
          console.error("Failed to send invite email:", emailError);
          // Don't block the user experience if email fails
        }
      }

      toast.success("Hot sheet shared successfully");
      setFriendEmail("");
      setShareDialogOpen(null);
      fetchHotSheets(user.id);
    } catch (error: any) {
      console.error("Error sharing hot sheet:", error);
      toast.error("Failed to share hot sheet");
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("hot_sheet_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;

      toast.success("Share removed");
      fetchHotSheets(user.id);
    } catch (error: any) {
      console.error("Error deleting share:", error);
      toast.error("Failed to remove share");
    }
  };

  const handleDeleteHotSheet = async (hotSheetId: string) => {
    if (!confirm("Are you sure you want to delete this hot sheet?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("hot_sheets")
        .delete()
        .eq("id", hotSheetId);

      if (error) throw error;

      toast.success("Hot sheet deleted");
      fetchHotSheets(user.id);
    } catch (error: any) {
      console.error("Error deleting hot sheet:", error);
      toast.error("Failed to delete hot sheet");
    }
  };

  const toggleSelection = (sheetId: string) => {
    const newSelected = new Set(selectedSheets);
    if (newSelected.has(sheetId)) {
      newSelected.delete(sheetId);
    } else {
      newSelected.add(sheetId);
    }
    setSelectedSheets(newSelected);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-20">
          <div className="text-center">
            <p className="text-muted-foreground">Loading hot sheets...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/agent-dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <PageTitle className="mb-2">Hot Sheets</PageTitle>
              <p className="text-muted-foreground">
                Welcome to your Hot Sheet Creator. Enter your search criteria and receive real-time listing updates.
              </p>
            </div>
          </div>

          {/* Create New Hot Sheet */}
          <Card className="aac-card border border-neutral-200 mb-8">
            <CardHeader>
              <CardTitle>Let's create or view your custom Hot Sheets.</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Hot Sheet
              </Button>
            </CardContent>
          </Card>

          {/* Hot Sheets Table */}
          {hotSheets.length === 0 ? (
            <Card className="aac-card border border-neutral-200 p-12">
              <div className="text-center">
                <Plus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No hot sheets yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first hot sheet to start receiving listing alerts
                </p>
              </div>
            </Card>
          ) : (
            <Card className="aac-card border border-neutral-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Hot Sheet Name</TableHead>
                    <TableHead>Contact Name</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotSheets.map((sheet) => {
                    const criteria = sheet.criteria as any;
                    const clients = (sheet as any).hot_sheet_clients?.map((hsc: any) => {
                      const c = hsc.clients;
                      return Array.isArray(c) ? c[0] : c;
                    }).filter(Boolean) || [];
                    const primaryClient = clients[0];

                    const clientName = primaryClient
                      ? [primaryClient.first_name, primaryClient.last_name].filter(Boolean).join(" ")
                      : ([criteria?.clientFirstName, criteria?.clientLastName].filter(Boolean).join(" ") || "—");

                    const contactInfo = primaryClient
                      ? [primaryClient.email, primaryClient.phone ? formatPhoneNumber(primaryClient.phone) : null]
                          .filter(Boolean)
                          .join(" | ") || "—"
                      : ([criteria?.clientEmail, criteria?.clientPhone ? formatPhoneNumber(criteria.clientPhone) : null]
                          .filter(Boolean)
                          .join(" | ") || "—");
                    
                    return (
                      <TableRow key={sheet.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSheets.has(sheet.id)}
                            onCheckedChange={() => toggleSelection(sheet.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{sheet.name}</TableCell>
                        <TableCell className="text-sm">{clientName}</TableCell>
                        <TableCell className="text-sm">{contactInfo}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendUpdate(sheet.id)}
                              title="Send Update"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCommentsDialogOpen(sheet.id)}
                              title="View Comments"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Dialog 
                              open={shareDialogOpen === sheet.id} 
                              onOpenChange={(open) => {
                                setShareDialogOpen(open ? sheet.id : null);
                                if (!open) setFriendEmail("");
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Share2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Share Hot Sheet</DialogTitle>
                                  <DialogDescription>
                                    Share this hot sheet with friends. They'll receive the same listing alerts.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="friend-email">Friend's Email</Label>
                                    <Input
                                      id="friend-email"
                                      type="email"
                                      placeholder="friend@example.com"
                                      value={friendEmail}
                                      onChange={(e) => setFriendEmail(e.target.value)}
                                    />
                                  </div>

                                  {sheet.shares && sheet.shares.length > 0 && (
                                    <div>
                                      <Label>Currently Shared With:</Label>
                                      <div className="mt-2 space-y-2">
                                        {sheet.shares.map((share) => (
                                          <div key={share.id} className="flex items-center justify-between p-2 bg-white border border-neutral-200 rounded">
                                            <span className="text-sm">{share.shared_with_email}</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDeleteShare(share.id)}
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setShareDialogOpen(null);
                                        setFriendEmail("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => handleShareHotSheet(sheet.id)}
                                      disabled={sharing || !friendEmail.trim()}
                                    >
                                      Share
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHotSheet(sheet.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Bulk Actions */}
              {hotSheets.length > 0 && (
                <div className="flex justify-center gap-4 p-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handleEditSelected}
                    disabled={selectedSheets.size !== 1}
                  >
                    Edit Hot Sheet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleShowResults}
                    disabled={selectedSheets.size !== 1}
                  >
                    Show Results
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={selectedSheets.size === 0}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>

      {/* Hot Sheet Creation Dialog */}
      <CreateHotSheetDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userId={user?.id}
        onSuccess={handleHotSheetSuccess}
      />

      {/* Hot Sheet Edit Dialog */}
      <CreateHotSheetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        userId={user?.id}
        onSuccess={handleHotSheetSuccess}
        hotSheetId={editingHotSheetId || undefined}
        editMode={true}
      />

      {/* Comments Dialog */}
      {commentsDialogOpen && (
        <HotSheetCommentsDialog
          open={!!commentsDialogOpen}
          onOpenChange={(open) => !open && setCommentsDialogOpen(null)}
          hotSheetId={commentsDialogOpen}
          hotSheetName={hotSheets.find(s => s.id === commentsDialogOpen)?.name || ""}
        />
      )}

      <Footer />
    </div>
  );
};

export default HotSheets;
