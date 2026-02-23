import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate } from "react-router-dom";

import PageShell from "@/components/layout/PageShell";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Users, ChevronRight } from "lucide-react";
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

interface BuyerSummary {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  hotSheetCount: number;
}

const HotSheets = () => {
  const navigate = useNavigate();
  const [hotSheets, setHotSheets] = useState<HotSheet[]>([]);
  const [buyers, setBuyers] = useState<BuyerSummary[]>([]);
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
    fetchBuyers(user.id);
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
          last_sent_at,
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

  const fetchBuyers = async (userId: string) => {
    try {
      const { data: hsData } = await supabase
        .from("hot_sheets")
        .select("id")
        .eq("user_id", userId);

      if (!hsData?.length) { setBuyers([]); return; }

      const hotSheetIds = hsData.map((h: any) => h.id);

      const { data: hscData } = await supabase
        .from("hot_sheet_clients")
        .select("client_id, hot_sheet_id")
        .in("hot_sheet_id", hotSheetIds);

      if (!hscData?.length) { setBuyers([]); return; }

      // Dedupe by client_id and count hot sheets per buyer
      const countMap = new Map<string, number>();
      for (const row of hscData) {
        countMap.set(row.client_id, (countMap.get(row.client_id) || 0) + 1);
      }

      const clientIds = Array.from(countMap.keys());
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email")
        .in("id", clientIds);

      const result: BuyerSummary[] = (clientsData || []).map((c: any) => ({
        clientId: c.id,
        firstName: c.first_name || "",
        lastName: c.last_name || "",
        email: c.email || "",
        hotSheetCount: countMap.get(c.id) || 0,
      }));

      result.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setBuyers(result);
    } catch (e) {
      console.error("Error fetching buyers:", e);
      setBuyers([]);
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
      <PageShell>
        <div className="flex flex-col gap-3 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-neutral-200 bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <PageShell className="pb-8">
        <PageHeader
          title="Your Buyer Hot Sheets"
          subtitle="Open a buyer to view their hot sheets, favorites, and activity."
          className="mb-8"
          actions={
            <Button variant="ghost" onClick={() => setCreateDialogOpen(true)} className="!bg-black hover:!bg-zinc-900 !text-emerald-400 font-display font-medium tracking-tight rounded-full px-5 py-2 !shadow-none hover:!shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Create New Hot Sheet
            </Button>
          }
        />

        {buyers.length === 0 ? (
          <div className="aac-card p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No buyers yet</h3>
            <p className="text-muted-foreground mb-6">
              No buyers linked to your hot sheets yet.
            </p>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(true)} className="!bg-black hover:!bg-zinc-900 !text-emerald-400 font-display font-medium tracking-tight rounded-full px-5 py-2 !shadow-none hover:!shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Create New Hot Sheet
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {buyers.map((buyer) => (
              <Card
                key={buyer.clientId}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/hot-sheets/buyer/${buyer.clientId}`)}
              >
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {buyer.firstName || buyer.lastName
                        ? `${buyer.firstName} ${buyer.lastName}`.trim()
                        : buyer.email || "Unknown"}
                    </p>
                    {buyer.email && (
                      <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {buyer.hotSheetCount} hot sheet{buyer.hotSheetCount !== 1 ? "s" : ""}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageShell>

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
    </>
  );
};

export default HotSheets;
