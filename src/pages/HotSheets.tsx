import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { CreateHotSheetDialog } from "@/components/CreateHotSheetDialog";
import { HotSheetCommentsDialog } from "@/components/HotSheetCommentsDialog";
import { BuyerCollectionCard } from "@/components/BuyerCollectionCard";
import { buildListingsQuery } from "@/lib/buildListingsQuery";

interface BuyerCollection {
  clientId: string;
  clientName: string;
  clientInitials: string;
  hotSheets: { id: string; name: string }[];
  photos: string[];
  collaborators: string[];
}

const getInitials = (first?: string, last?: string): string => {
  const f = (first || "")[0]?.toUpperCase() || "";
  const l = (last || "")[0]?.toUpperCase() || "";
  return f + l || "?";
};

const HotSheets = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<BuyerCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [agentInitials, setAgentInitials] = useState("AG");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState<string | null>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState<string | null>(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHotSheetId, setEditingHotSheetId] = useState<string | null>(null);
  // Keep raw hot sheets for dialog lookups
  const [rawHotSheets, setRawHotSheets] = useState<any[]>([]);

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

    // Fetch agent initials
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      setAgentInitials(getInitials(profile.first_name, profile.last_name));
    }

    fetchData(user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      setLoading(true);

      // 1. Fetch hot sheets with clients and shares
      const { data: hsData, error } = await supabase
        .from("hot_sheets")
        .select(`
          id, name, criteria, is_active, created_at, last_sent_at,
          hot_sheet_shares ( id, shared_with_email, created_at ),
          hot_sheet_clients ( client_id, clients ( id, first_name, last_name, email, phone ) )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const sheets = (hsData || []) as any[];
      setRawHotSheets(sheets);

      if (!sheets.length) {
        setCollections([]);
        return;
      }

      // 2. Fetch listing photos from criteria-matched listings for each sheet
      const photosPerSheet = new Map<string, string[]>();
      for (const sheet of sheets) {
        const criteria = sheet.criteria as any;
        if (!criteria) continue;
        try {
          const { data: matchedListings } = await buildListingsQuery(supabase, criteria).limit(20);
          const photos: string[] = [];
          for (const l of matchedListings || []) {
            const lPhotos = l.photos as any[] | null;
            if (lPhotos?.length && photos.length < 4) {
              const raw = lPhotos[0];
              const url = typeof raw === "string" ? raw : raw?.url || null;
              if (url) photos.push(url);
            }
          }
          if (photos.length) photosPerSheet.set(sheet.id, photos);
        } catch (e) {
          console.error("Error fetching matches for", sheet.id, e);
        }
      }

      // 3. Group by client
      const clientMap = new Map<string, BuyerCollection>();

      for (const sheet of sheets) {
        const clients = (sheet.hot_sheet_clients || []).map((hsc: any) => {
          const c = hsc.clients;
          return Array.isArray(c) ? c[0] : c;
        }).filter(Boolean);

        // Collect collaborator emails from shares
        const shareEmails = (sheet.hot_sheet_shares || []).map((s: any) => s.shared_with_email);
        const collabInitials = shareEmails.map((e: string) => {
          const parts = e.split("@")[0].split(/[._-]/);
          return parts.map((p: string) => p[0]?.toUpperCase() || "").join("").slice(0, 2);
        });

        // Get photos for this sheet from criteria matches
        const sheetPhotos: string[] = photosPerSheet.get(sheet.id) || [];

        if (clients.length === 0) {
          // Hot sheet with no client — use criteria name or sheet name
          const key = `__no_client_${sheet.id}`;
          clientMap.set(key, {
            clientId: sheet.id,
            clientName: sheet.criteria?.clientFirstName
              ? [sheet.criteria.clientFirstName, sheet.criteria.clientLastName].filter(Boolean).join(" ")
              : sheet.name,
            clientInitials: getInitials(sheet.criteria?.clientFirstName, sheet.criteria?.clientLastName),
            hotSheets: [{ id: sheet.id, name: sheet.name }],
            photos: sheetPhotos,
            collaborators: collabInitials,
          });
        } else {
          for (const client of clients) {
            const existing = clientMap.get(client.id);
            if (existing) {
              existing.hotSheets.push({ id: sheet.id, name: sheet.name });
              // Merge photos up to 4
              for (const ph of sheetPhotos) {
                if (existing.photos.length < 4 && !existing.photos.includes(ph)) {
                  existing.photos.push(ph);
                }
              }
              // Merge collaborators
              for (const ci of collabInitials) {
                if (!existing.collaborators.includes(ci)) existing.collaborators.push(ci);
              }
            } else {
              clientMap.set(client.id, {
                clientId: client.id,
                clientName: [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed Client",
                clientInitials: getInitials(client.first_name, client.last_name),
                hotSheets: [{ id: sheet.id, name: sheet.name }],
                photos: sheetPhotos,
                collaborators: collabInitials,
              });
            }
          }
        }
      }

      setCollections(Array.from(clientMap.values()));
    } catch (error: any) {
      console.error("Error fetching hot sheets:", error);
      toast.error("Failed to load hot sheets");
    } finally {
      setLoading(false);
    }
  };

  const handleHotSheetSuccess = (hotSheetId: string) => {
    if (editingHotSheetId) {
      fetchData(user.id);
      setEditingHotSheetId(null);
    } else {
      navigate(`/hot-sheets/${hotSheetId}/review`);
    }
  };

  const handleCardClick = (collection: BuyerCollection) => {
    if (collection.hotSheets.length === 1) {
      navigate(`/hot-sheets/${collection.hotSheets[0].id}/review`);
    } else {
      navigate(`/hot-sheets/buyer/${collection.clientId}`);
    }
  };

  // Share dialog handlers (kept for existing dialogs)
  const handleShareHotSheet = async (hotSheetId: string) => {
    if (!friendEmail.trim()) { toast.error("Please enter a friend's email"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(friendEmail)) { toast.error("Please enter a valid email address"); return; }
    try {
      setSharing(true);
      const { error } = await supabase
        .from("hot_sheet_shares")
        .insert({ hot_sheet_id: hotSheetId, shared_with_email: friendEmail.toLowerCase(), shared_by_user_id: user.id });
      if (error) {
        if (error.code === "23505") toast.error("This hot sheet is already shared with this email");
        else throw error;
        return;
      }
      const hotSheet = rawHotSheets.find((s: any) => s.id === hotSheetId);
      if (hotSheet) {
        try {
          await supabase.functions.invoke("send-hot-sheet-invite", {
            body: { invitedEmail: friendEmail.toLowerCase(), inviterName: user.email?.split("@")[0] || "A friend", hotSheetName: hotSheet.name, hotSheetLink: `${window.location.origin}/hot-sheets` },
          });
        } catch (emailError) { console.error("Failed to send invite email:", emailError); }
      }
      toast.success("Hot sheet shared successfully");
      setFriendEmail("");
      setShareDialogOpen(null);
      fetchData(user.id);
    } catch (error: any) {
      console.error("Error sharing hot sheet:", error);
      toast.error("Failed to share hot sheet");
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      const { error } = await supabase.from("hot_sheet_shares").delete().eq("id", shareId);
      if (error) throw error;
      toast.success("Share removed");
      fetchData(user.id);
    } catch (error: any) {
      console.error("Error deleting share:", error);
      toast.error("Failed to remove share");
    }
  };

  const handleDeleteHotSheet = async (hotSheetId: string) => {
    if (!confirm("Are you sure you want to delete this hot sheet?")) return;
    try {
      const { error } = await supabase.from("hot_sheets").delete().eq("id", hotSheetId);
      if (error) throw error;
      toast.success("Hot sheet deleted");
      fetchData(user.id);
    } catch (error: any) {
      console.error("Error deleting hot sheet:", error);
      toast.error("Failed to delete hot sheet");
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          title="Buyer HotSheets"
          subtitle="Collections of listings curated for each buyer or renter client."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-zinc-50 animate-pulse">
              <div className="aspect-[4/3] bg-zinc-100 rounded-t-2xl" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-zinc-200 rounded w-2/3" />
                <div className="h-4 bg-zinc-100 rounded w-1/3" />
                <div className="flex gap-2 mt-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-200" />
                  <div className="h-8 w-8 rounded-full bg-zinc-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <PageShell className="pb-8">
        <PageHeader
          title="Buyer HotSheets"
          subtitle="Collections of listings curated for each buyer or renter client."
          backTo="/agent-dashboard"
          actions={
            <Button
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Client HotSheet
            </Button>
          }
        />

        {collections.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
            <h3 className="text-xl font-semibold text-zinc-900 mb-2">No buyer hot sheets yet</h3>
            <p className="text-zinc-500 mb-6">
              Create your first hot sheet to start curating listings for your buyers.
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Client HotSheet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <BuyerCollectionCard
                key={collection.clientId}
                clientId={collection.clientId}
                clientName={collection.clientName}
                hotSheetCount={collection.hotSheets.length}
                photos={collection.photos}
                agentInitials={agentInitials}
                clientInitials={collection.clientInitials}
                collaborators={collection.collaborators}
                onClick={() => handleCardClick(collection)}
              />
            ))}
          </div>
        )}
      </PageShell>

      {/* Share Dialog */}
      <Dialog
        open={!!shareDialogOpen}
        onOpenChange={(open) => { if (!open) { setShareDialogOpen(null); setFriendEmail(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Hot Sheet</DialogTitle>
            <DialogDescription>Share this hot sheet with friends. They'll receive the same listing alerts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="friend-email">Friend's Email</Label>
              <Input id="friend-email" type="email" placeholder="friend@example.com" value={friendEmail} onChange={(e) => setFriendEmail(e.target.value)} />
            </div>
            {shareDialogOpen && rawHotSheets.find((s: any) => s.id === shareDialogOpen)?.hot_sheet_shares?.length ? (
              <div>
                <Label>Currently Shared With:</Label>
                <div className="mt-2 space-y-2">
                  {rawHotSheets.find((s: any) => s.id === shareDialogOpen)?.hot_sheet_shares?.map((share: any) => (
                    <div key={share.id} className="flex items-center justify-between p-2 bg-white border border-zinc-200 rounded">
                      <span className="text-sm">{share.shared_with_email}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteShare(share.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShareDialogOpen(null); setFriendEmail(""); }}>Cancel</Button>
              <Button onClick={() => shareDialogOpen && handleShareHotSheet(shareDialogOpen)} disabled={sharing || !friendEmail.trim()}>Share</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hot Sheet Creation Dialog */}
      <CreateHotSheetDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} userId={user?.id} onSuccess={handleHotSheetSuccess} />

      {/* Hot Sheet Edit Dialog */}
      <CreateHotSheetDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} userId={user?.id} onSuccess={handleHotSheetSuccess} hotSheetId={editingHotSheetId || undefined} editMode={true} />

      {/* Comments Dialog */}
      {commentsDialogOpen && (
        <HotSheetCommentsDialog
          open={!!commentsDialogOpen}
          onOpenChange={(open) => !open && setCommentsDialogOpen(null)}
          hotSheetId={commentsDialogOpen}
          hotSheetName={rawHotSheets.find((s: any) => s.id === commentsDialogOpen)?.name || ""}
        />
      )}
    </>
  );
};

export default HotSheets;
