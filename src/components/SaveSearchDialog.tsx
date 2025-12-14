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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Save Search
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="search-name" className="text-sm font-medium">
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
          <p className="text-xs text-muted-foreground mt-2">
            You can manage saved searches from My Saved Searches.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSearchDialog;
