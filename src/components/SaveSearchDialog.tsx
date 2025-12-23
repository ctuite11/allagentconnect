import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bookmark } from "lucide-react";

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchSummary?: string;
}

const SaveSearchDialog = ({ open, onOpenChange, searchSummary }: SaveSearchDialogProps) => {
  const [searchName, setSearchName] = useState("");

  // Generate default name from summary or generic
  useEffect(() => {
    if (open) {
      setSearchName(searchSummary || `Search ${new Date().toLocaleDateString()}`);
    }
  }, [open, searchSummary]);

  const handleSave = () => {
    if (!searchName.trim()) {
      toast.error("Please enter a name for this search");
      return;
    }

    const searchUrl = window.location.href;
    const savedSearches = JSON.parse(localStorage.getItem("savedSearches") || "[]");
    savedSearches.push({
      url: searchUrl,
      savedAt: new Date().toISOString(),
      name: searchName.trim(),
    });
    localStorage.setItem("savedSearches", JSON.stringify(savedSearches));
    
    toast.success("Search saved to My Saved Searches");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-neutral-200 rounded-2xl shadow-lg w-[min(92vw,480px)] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 py-5 border-b border-neutral-200">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
            <Bookmark className="h-5 w-5 text-emerald-600" />
            Save Search
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Label htmlFor="search-name" className="text-sm font-medium text-neutral-900">
            Search name
          </Label>
          <Input
            id="search-name"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="e.g., Boston • 2+ Beds • $700k–$1.1M"
            className="mt-1.5"
            autoFocus
          />
          <p className="text-sm text-neutral-600 mt-2">
            You can manage saved searches from My Saved Searches.
          </p>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSearchDialog;
