import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { format, differenceInDays, isPast, addDays } from "date-fns";
import { Home, Users, Clock, RefreshCw, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface SellerSubmission {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  created_at: string;
  expires_at: string;
  status: string;
}

interface SellerMatch {
  id: string;
  submission_id: string;
  created_at: string;
  latest_outcome: string;
  latest_outcome_at: string | null;
  next_followup_at: string | null;
  archived_at: string | null;
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800" },
  no_response: { label: "No Response", color: "bg-zinc-100 text-zinc-600" },
  not_a_fit: { label: "Not a Fit", color: "bg-zinc-100 text-zinc-600" },
  connected: { label: "Connected", color: "bg-blue-100 text-blue-800" },
  showing_scheduled: { label: "Showing Scheduled", color: "bg-indigo-100 text-indigo-800" },
  offer_submitted: { label: "Offer Submitted", color: "bg-purple-100 text-purple-800" },
  offer_accepted: { label: "Offer Accepted", color: "bg-emerald-100 text-emerald-800" },
  closed_won: { label: "Closed (Won)", color: "bg-emerald-100 text-emerald-800" },
  closed_lost: { label: "Closed (Lost)", color: "bg-red-100 text-red-800" },
  duplicate: { label: "Duplicate", color: "bg-zinc-100 text-zinc-600" },
  invalid: { label: "Invalid", color: "bg-red-100 text-red-600" },
};

export default function SellerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<SellerSubmission | null>(null);
  const [matches, setMatches] = useState<SellerMatch[]>([]);
  const [isRenewing, setIsRenewing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      // Fetch seller's submission (most recent paid one)
      const { data: submissionData, error: subError } = await supabase
        .from("agent_match_submissions")
        .select("id, address, city, state, zip_code, created_at, expires_at, status")
        .eq("user_id", session.user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error("Error fetching submission:", subError);
      }

      if (submissionData) {
        setSubmission(submissionData);

        // Fetch matches for this submission using the public view
        const { data: matchData, error: matchError } = await supabase
          .from("seller_matches_public")
          .select("*")
          .eq("submission_id", submissionData.id)
          .is("archived_at", null)
          .order("created_at", { ascending: false });

        if (matchError) {
          console.error("Error fetching matches:", matchError);
        } else {
          setMatches(matchData || []);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [navigate]);

  const handleRenew = async () => {
    if (!submission) return;
    
    setIsRenewing(true);
    try {
      const newExpiresAt = addDays(new Date(), 30);

      const { error } = await supabase
        .from("agent_match_submissions")
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq("id", submission.id);

      if (error) throw error;

      setSubmission({ ...submission, expires_at: newExpiresAt.toISOString() });
      toast.success("Renewed — your listing is active for 30 more days");
    } catch (error) {
      console.error("Error renewing:", error);
      toast.error("Failed to renew listing. Please try again.");
    } finally {
      setIsRenewing(false);
    }
  };

  // Calculate stats
  const totalMatches = matches.length;
  const unreportedMatches = matches.filter(m => m.latest_outcome === "pending").length;
  const reportedMatches = totalMatches - unreportedMatches;

  // Calculate expiration status
  const isExpired = submission ? isPast(new Date(submission.expires_at)) : false;
  const daysRemaining = submission 
    ? differenceInDays(new Date(submission.expires_at), new Date()) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <PageHeader
            title="Seller Dashboard"
            subtitle="Manage your property listing"
            backTo="/"
          />
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <Home className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Active Listing</h3>
              <p className="text-slate-600 mb-6">
                You don't have an active seller listing yet.
              </p>
              <Button onClick={() => navigate("/agent-match")}>
                Create Listing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PageHeader
          title="Seller Dashboard"
          subtitle="Track your listing and agent matches"
          backTo="/"
        />

        <div className="grid gap-6 mt-8">
          {/* Listing Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-slate-600" />
                  Your Listing
                </CardTitle>
                <Badge className={isExpired ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                  {isExpired ? "Expired" : "Active"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {submission.address}
                  </p>
                  <p className="text-slate-600">
                    {submission.city}, {submission.state} {submission.zip_code}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Created {format(new Date(submission.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                
                <div className="flex flex-col justify-center">
                  {isExpired ? (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800 mb-2">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Listing Expired</span>
                      </div>
                      <p className="text-sm text-red-700 mb-3">
                        Expired on {format(new Date(submission.expires_at), "MMM d, yyyy")}
                      </p>
                      <Button 
                        onClick={handleRenew} 
                        disabled={isRenewing}
                        className="w-full"
                      >
                        {isRenewing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Renewing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Renew Listing
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-emerald-800 mb-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Listing Active</span>
                      </div>
                      <p className="text-sm text-emerald-700">
                        Expires on {format(new Date(submission.expires_at), "MMM d, yyyy")}
                        {daysRemaining > 0 && ` (${daysRemaining} days remaining)`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Match Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{totalMatches}</p>
                    <p className="text-sm text-slate-600">Total Matches</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{unreportedMatches}</p>
                    <p className="text-sm text-slate-600">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{reportedMatches}</p>
                    <p className="text-sm text-slate-600">Reported</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Matches Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-600" />
                Agent Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No agent matches yet.</p>
                  <p className="text-sm mt-1">Matches will appear here as agents are notified.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Match Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Next Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((match) => {
                      const outcomeConfig = OUTCOME_LABELS[match.latest_outcome] || { 
                        label: match.latest_outcome, 
                        color: "bg-slate-100 text-slate-600" 
                      };
                      
                      return (
                        <TableRow key={match.id}>
                          <TableCell>
                            {format(new Date(match.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge className={outcomeConfig.color}>
                              {outcomeConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {match.latest_outcome_at 
                              ? format(new Date(match.latest_outcome_at), "MMM d, yyyy")
                              : "—"
                            }
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {match.next_followup_at 
                              ? format(new Date(match.next_followup_at), "MMM d, yyyy")
                              : "—"
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}