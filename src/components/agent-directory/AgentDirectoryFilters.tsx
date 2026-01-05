import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, Eye } from "lucide-react";

interface AgentDirectoryFiltersProps {
  sortOrder: "a-z" | "z-a" | "listings" | "recent";
  setSortOrder: (order: "a-z" | "z-a" | "listings" | "recent") => void;
  onClearFilters: () => void;
  resultCount: number;
  isAgentMode: boolean;
  setIsAgentMode: (value: boolean) => void;
  showAgentModeToggle: boolean;
  hasActiveFilters: boolean;
}

const AgentDirectoryFilters = ({
  sortOrder,
  setSortOrder,
  onClearFilters,
  resultCount,
  isAgentMode,
  setIsAgentMode,
  showAgentModeToggle,
  hasActiveFilters,
}: AgentDirectoryFiltersProps) => {
  return (
    <div className="sticky top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Sort:</Label>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a" | "listings" | "recent")}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a-z">Name A-Z</SelectItem>
                <SelectItem value="z-a">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent Mode Toggle - Only visible to authenticated agents */}
          {showAgentModeToggle && (
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Switch
                id="agent-mode-toggle"
                checked={isAgentMode}
                onCheckedChange={setIsAgentMode}
              />
              <Label htmlFor="agent-mode-toggle" className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer">
                <Eye className="h-3.5 w-3.5 inline-block mr-1" />
                Agent Intel
              </Label>
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* Result Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{resultCount}</span> {isAgentMode ? "members" : "agents"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDirectoryFilters;