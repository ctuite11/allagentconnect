import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Search, MessageSquare, Users } from "lucide-react";
import { format } from "date-fns";

interface Registration {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  brokerage: string;
  state: string;
  license_number: string;
  markets: string | null;
  specialties: string[] | null;
  status: string;
  verified_at: string | null;
  verified_by: string | null;
  founding_partner: boolean;
  notes: string | null;
}

const AdminEarlyAccess: React.FC = () => {
  const { user, isAdmin, loading: authLoading } = useAuthRole();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; registration: Registration | null }>({
    open: false,
    registration: null,
  });
  const [noteText, setNoteText] = useState("");
  const [verifiedCount, setVerifiedCount] = useState(0);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchRegistrations();
      fetchVerifiedCount();
    }
  }, [authLoading, isAdmin]);

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from("agent_early_access")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRegistrations(data || []);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      toast.error("Failed to load registrations");
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifiedCount = async () => {
    try {
      const { data, error } = await supabase.rpc("get_verified_early_access_count");
      if (error) throw error;
      setVerifiedCount(data || 0);
    } catch (error) {
      console.error("Error fetching verified count:", error);
    }
  };

  const handleVerify = async (registration: Registration) => {
    try {
      const isFoundingPartner = verifiedCount < 250;

      const { error: updateError } = await supabase
        .from("agent_early_access")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
          founding_partner: isFoundingPartner,
        })
        .eq("id", registration.id);

      if (updateError) throw updateError;

      // Send verified email
      try {
        await supabase.functions.invoke("send-early-access-verified", {
          body: {
            email: registration.email,
            firstName: registration.first_name,
            foundingPartner: isFoundingPartner,
          },
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
        toast.error("Agent verified but email failed to send");
      }

      toast.success(
        `${registration.first_name} ${registration.last_name} verified${isFoundingPartner ? " as Founding Partner" : ""}`
      );

      fetchRegistrations();
      fetchVerifiedCount();
    } catch (error) {
      console.error("Verify error:", error);
      toast.error("Failed to verify agent");
    }
  };

  const handleReject = async (registration: Registration) => {
    try {
      const { error } = await supabase
        .from("agent_early_access")
        .update({
          status: "rejected",
        })
        .eq("id", registration.id);

      if (error) throw error;

      toast.success(`${registration.first_name} ${registration.last_name} rejected`);
      fetchRegistrations();
    } catch (error) {
      console.error("Reject error:", error);
      toast.error("Failed to reject agent");
    }
  };

  const handleSaveNote = async () => {
    if (!noteDialog.registration) return;

    try {
      const { error } = await supabase
        .from("agent_early_access")
        .update({ notes: noteText })
        .eq("id", noteDialog.registration.id);

      if (error) throw error;

      toast.success("Note saved");
      setNoteDialog({ open: false, registration: null });
      setNoteText("");
      fetchRegistrations();
    } catch (error) {
      console.error("Note save error:", error);
      toast.error("Failed to save note");
    }
  };

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.license_number.toLowerCase().includes(q) ||
          r.brokerage.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [registrations, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      pending: registrations.filter((r) => r.status === "pending").length,
      verified: registrations.filter((r) => r.status === "verified").length,
      rejected: registrations.filter((r) => r.status === "rejected").length,
    };
  }, [registrations]);

  if (authLoading) {
    return <LoadingScreen message="Checking access..." />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Early Access Approvals — Admin</title>
      </Helmet>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Early Access Registrations
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {verifiedCount} of 250 Founding Partner spots filled
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Users className="w-3 h-3" />
                {statusCounts.pending} pending
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                {statusCounts.verified} verified
              </Badge>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="flex items-center justify-center py-12 border border-border rounded-lg">
              <p className="text-muted-foreground">No registrations found</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Brokerage</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.first_name} {r.last_name}
                        {r.founding_partner && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Founding
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell>{r.brokerage}</TableCell>
                      <TableCell>{r.state}</TableCell>
                      <TableCell className="font-mono text-sm">{r.license_number}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "verified"
                              ? "default"
                              : r.status === "rejected"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(r.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleVerify(r)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReject(r)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNoteDialog({ open: true, registration: r });
                              setNoteText(r.notes || "");
                            }}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog
        open={noteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setNoteDialog({ open: false, registration: null });
            setNoteText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Notes for {noteDialog.registration?.first_name}{" "}
              {noteDialog.registration?.last_name}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Add internal notes..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNoteDialog({ open: false, registration: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminEarlyAccess;
