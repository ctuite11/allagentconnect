import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, Check, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderBackgroundSelectorProps {
  backgroundType: string;
  backgroundValue: string;
  headerImageUrl: string;
  onTypeChange: (type: string) => void;
  onValueChange: (value: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
  uploadingImage: boolean;
}

// 7 Theme Options
const THEMES = [
  { 
    id: "allagentconnect", 
    name: "AllAgentConnect", 
    description: "Brand Gradient",
    style: "linear-gradient(135deg, hsl(215, 85%, 45%) 0%, hsl(270, 70%, 50%) 100%)",
    preview: "bg-gradient-to-br from-blue-600 to-purple-600"
  },
  { 
    id: "compass", 
    name: "Compass", 
    description: "Black & White",
    style: "linear-gradient(135deg, hsl(0, 0%, 8%) 0%, hsl(0, 0%, 15%) 100%)",
    preview: "bg-gradient-to-br from-gray-900 to-gray-800"
  },
  { 
    id: "coldwell-banker", 
    name: "Coldwell Banker", 
    description: "Deep Navy",
    style: "linear-gradient(135deg, hsl(215, 60%, 20%) 0%, hsl(215, 50%, 30%) 100%)",
    preview: "bg-gradient-to-br from-blue-950 to-blue-900"
  },
  { 
    id: "berkshire", 
    name: "Berkshire Hathaway", 
    description: "Plum Purple",
    style: "linear-gradient(135deg, hsl(280, 40%, 25%) 0%, hsl(280, 35%, 35%) 100%)",
    preview: "bg-gradient-to-br from-purple-950 to-purple-800"
  },
  { 
    id: "century21", 
    name: "Century 21", 
    description: "Black & Gold",
    style: "linear-gradient(135deg, hsl(0, 0%, 10%) 0%, hsl(40, 70%, 35%) 100%)",
    preview: "bg-gradient-to-br from-gray-900 to-amber-700"
  },
  { 
    id: "remax", 
    name: "RE/MAX", 
    description: "Red, White & Blue",
    style: "linear-gradient(135deg, hsl(0, 75%, 45%) 0%, hsl(215, 80%, 45%) 100%)",
    preview: "bg-gradient-to-br from-red-600 to-blue-600"
  },
];

export const getHeaderBackgroundStyle = (type: string, value: string, imageUrl?: string): React.CSSProperties => {
  // Custom image upload
  if (type === "custom" && imageUrl) {
    return {
      backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${imageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  
  // Theme-based backgrounds
  const theme = THEMES.find(t => t.id === value);
  if (theme) {
    return { background: theme.style };
  }
  
  // Default to AllAgentConnect theme
  return { background: THEMES[0].style };
};

const HeaderBackgroundSelector = ({
  backgroundType,
  backgroundValue,
  headerImageUrl,
  onTypeChange,
  onValueChange,
  onImageUpload,
  onImageRemove,
  uploadingImage,
}: HeaderBackgroundSelectorProps) => {
  const isCustom = backgroundType === "custom";

  const handleThemeSelect = (themeId: string) => {
    onTypeChange("theme");
    onValueChange(themeId);
  };

  const handleCustomSelect = () => {
    onTypeChange("custom");
    onValueChange("");
  };

  return (
    <div className="space-y-5">
      <Label className="text-sm font-medium">Choose Header Theme</Label>
      
      {/* Theme Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => handleThemeSelect(theme.id)}
            className={cn(
              "relative h-20 rounded-lg overflow-hidden border-2 transition-all",
              theme.preview,
              backgroundType === "theme" && backgroundValue === theme.id
                ? "border-foreground ring-2 ring-primary ring-offset-2" 
                : "border-transparent hover:border-foreground/40"
            )}
          >
            {backgroundType === "theme" && backgroundValue === theme.id && (
              <div className="absolute top-2 right-2">
                <Check className="h-4 w-4 text-white drop-shadow-md" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white text-xs font-semibold">{theme.name}</p>
              <p className="text-white/70 text-[10px]">{theme.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Image Upload Option */}
      <div className="pt-2 border-t">
        <button
          type="button"
          onClick={handleCustomSelect}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
            isCustom
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isCustom ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          )}>
            <Image className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Custom Image Upload</p>
            <p className="text-xs text-muted-foreground">Upload your own header background</p>
          </div>
          {isCustom && <Check className="h-4 w-4 text-primary ml-auto" />}
        </button>
      </div>

      {/* Image Upload Section - Only show when custom is selected */}
      {isCustom && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/30">
          <Label className="text-xs text-muted-foreground">
            Recommended: 1800×600px (JPG or PNG)
          </Label>
          
          {headerImageUrl ? (
            <div className="relative rounded-lg overflow-hidden">
              <img 
                src={headerImageUrl} 
                alt="Header background" 
                className="w-full h-28 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={onImageRemove}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={onImageUpload}
                className="hidden"
                disabled={uploadingImage}
              />
              {uploadingImage ? (
                <div className="animate-pulse text-muted-foreground">Uploading...</div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload</span>
                </>
              )}
            </label>
          )}
        </div>
      )}

      {/* Live Preview */}
      <div className="space-y-2 pt-2">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div 
          className="h-20 rounded-lg overflow-hidden flex items-center justify-center"
          style={getHeaderBackgroundStyle(backgroundType, backgroundValue, headerImageUrl)}
        >
          <span className="text-white font-semibold drop-shadow-md">Header Preview</span>
        </div>
      </div>
    </div>
  );
};

export default HeaderBackgroundSelector;
