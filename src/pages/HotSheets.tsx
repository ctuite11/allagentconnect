import { useState, useEffect } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { HotSheetCommentsDialog } from "@/components/HotSheetCommentsDialog";
import { HotSheetCard } from "@/components/HotSheetCard";

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
      fetchHotSheets(user.id);
      setEditingHotSheetId(null);
    } else {
      navigate(`/hot-sheets/${hotSheetId}/review`);
    }
  };

  const handleShowResults = (sheetId: string) => {
    navigate(`/hot-sheets/${sheetId}/review`);
  };

  const handleEdit = (sheetId: string) => {
    setEditingHotSheetId(sheetId);
    setEditDialogOpen(true);
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

  const getClientsForSheet = (sheet: any) => {
    return (sheet.hot_sheet_clients?.map((hsc: any) => {
      const c = hsc.clients;
      return Array.isArray(c) ? c[0] : c;
    }).filter(Boolean) || []);
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
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <PageTitle className="mb-1">Hot Sheets</PageTitle>
              <p className="text-muted-foreground text-sm">
                Create and manage your custom listing alerts
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Hot Sheet
            </Button>
          </div>

          {/* Hot Sheets List */}
          {hotSheets.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
              <Plus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No hot sheets yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first hot sheet to start receiving listing alerts
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Hot Sheet
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {hotSheets.map((sheet) => (
                <HotSheetCard
                  key={sheet.id}
                  id={sheet.id}
                  name={sheet.name}
                  criteria={sheet.criteria}
                  clients={getClientsForSheet(sheet)}
                  onShowResults={handleShowResults}
                  onEdit={handleEdit}
                  onShare={(id) => setShareDialogOpen(id)}
                  onSendUpdate={handleSendUpdate}
                  onComments={(id) => setCommentsDialogOpen(id)}
                  onDelete={handleDeleteHotSheet}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Share Dialog */}
      <Dialog 
        open={!!shareDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setShareDialogOpen(null);
            setFriendEmail("");
          }
        }}
      >
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

            {shareDialogOpen && hotSheets.find(s => s.id === shareDialogOpen)?.shares?.length ? (
              <div>
                <Label>Currently Shared With:</Label>
                <div className="mt-2 space-y-2">
                  {hotSheets.find(s => s.id === shareDialogOpen)?.shares?.map((share) => (
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
            ) : null}

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
                onClick={() => shareDialogOpen && handleShareHotSheet(shareDialogOpen)}
                disabled={sharing || !friendEmail.trim()}
              >
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
