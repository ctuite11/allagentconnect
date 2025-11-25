import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface PublicRecordModalProps {
  attomId: string | null;
  onClose: () => void;
}

export const PublicRecordModal: React.FC<PublicRecordModalProps> = ({
  attomId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecord = async () => {
      if (!attomId) {
        setError("No ATTOM ID available for this property");
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("public_records_cache")
        .select("raw")
        .eq("attom_id", attomId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error loading public record:", fetchError);
        setError("Failed to load public record");
      } else if (!data) {
        setError("Public record not found in cache");
      } else {
        setRecord(data.raw);
      }

      setLoading(false);
    };

    loadRecord();
  }, [attomId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Public Record Details</DialogTitle>
          <DialogDescription>
            Full property data from ATTOM public records
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            <pre className="text-xs font-mono">
              {JSON.stringify(record, null, 2)}
            </pre>
          </ScrollArea>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
