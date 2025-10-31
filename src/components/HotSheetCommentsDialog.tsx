import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  listing_id: string;
  comment: string;
  created_at: string;
  listings: {
    address: string;
    city: string;
    state: string;
    price: number;
  };
}

interface HotSheetCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotSheetId: string;
  hotSheetName: string;
}

export function HotSheetCommentsDialog({
  open,
  onOpenChange,
  hotSheetId,
  hotSheetName,
}: HotSheetCommentsDialogProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && hotSheetId) {
      fetchComments();
    }
  }, [open, hotSheetId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("hot_sheet_comments")
        .select(`
          id,
          listing_id,
          comment,
          created_at,
          listings (
            address,
            city,
            state,
            price
          )
        `)
        .eq("hot_sheet_id", hotSheetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments((data || []) as any);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Comments - {hotSheetName}</DialogTitle>
          <DialogDescription>
            View feedback from your client on matching properties
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading comments...</p>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your client can add comments to properties they're interested in
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{comment.listings.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {comment.listings.city}, {comment.listings.state} - ${comment.listings.price.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm">{comment.comment}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}