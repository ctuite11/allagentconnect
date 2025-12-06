import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Upload, X, Check, Image, Palette, Grid3X3 } from "lucide-react";
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

const GRADIENTS = [
  { id: "blue-indigo", name: "Blue → Indigo", class: "bg-gradient-to-r from-blue-600 to-indigo-700" },
  { id: "navy-teal", name: "Navy → Teal", class: "bg-gradient-to-r from-slate-800 to-teal-600" },
  { id: "black-charcoal", name: "Black → Charcoal", class: "bg-gradient-to-r from-gray-900 to-gray-700" },
  { id: "gold-beige", name: "Gold → Beige", class: "bg-gradient-to-r from-amber-600 to-orange-200" },
  { id: "slate-silver", name: "Slate → Silver", class: "bg-gradient-to-r from-slate-600 to-gray-300" },
  { id: "sunset", name: "Sunset", class: "bg-gradient-to-r from-orange-500 to-rose-600" },
];

const PATTERNS = [
  { id: "geometric", name: "Geometric", preview: "◆ ◇ ◆" },
  { id: "diagonal", name: "Diagonal Fade", preview: "╱╲╱" },
  { id: "grid", name: "Grid Lines", preview: "┼┼┼" },
  { id: "dots", name: "Dot Pattern", preview: "• • •" },
  { id: "linen", name: "Linen Texture", preview: "≡≡≡" },
  { id: "branded", name: "DirectConnect", preview: "AAC" },
];

export const getHeaderBackgroundStyle = (type: string, value: string, imageUrl?: string) => {
  if (type === "image" && imageUrl) {
    return {
      backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url(${imageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  
  if (type === "gradient") {
    const gradientMap: Record<string, string> = {
      "blue-indigo": "linear-gradient(135deg, hsl(215, 85%, 45%) 0%, hsl(245, 70%, 50%) 100%)",
      "navy-teal": "linear-gradient(135deg, hsl(215, 50%, 25%) 0%, hsl(175, 60%, 40%) 100%)",
      "black-charcoal": "linear-gradient(135deg, hsl(0, 0%, 10%) 0%, hsl(0, 0%, 30%) 100%)",
      "gold-beige": "linear-gradient(135deg, hsl(38, 80%, 50%) 0%, hsl(30, 70%, 75%) 100%)",
      "slate-silver": "linear-gradient(135deg, hsl(215, 20%, 40%) 0%, hsl(210, 15%, 75%) 100%)",
      "sunset": "linear-gradient(135deg, hsl(25, 90%, 55%) 0%, hsl(350, 75%, 55%) 100%)",
    };
    return { background: gradientMap[value] || gradientMap["blue-indigo"] };
  }
  
  if (type === "pattern") {
    const patternMap: Record<string, { background: string; backgroundSize?: string }> = {
      "geometric": {
        background: `linear-gradient(135deg, hsl(215, 70%, 50%) 0%, hsl(225, 60%, 40%) 100%)`,
      },
      "diagonal": {
        background: `repeating-linear-gradient(45deg, hsl(215, 60%, 45%), hsl(215, 60%, 45%) 10px, hsl(215, 70%, 50%) 10px, hsl(215, 70%, 50%) 20px)`,
      },
      "grid": {
        background: `linear-gradient(hsl(215, 60%, 45%) 1px, transparent 1px), linear-gradient(90deg, hsl(215, 60%, 45%) 1px, transparent 1px), linear-gradient(135deg, hsl(215, 70%, 40%) 0%, hsl(225, 60%, 35%) 100%)`,
        backgroundSize: "20px 20px, 20px 20px, 100% 100%",
      },
      "dots": {
        background: `radial-gradient(circle, hsl(215, 50%, 60%) 1px, transparent 1px), linear-gradient(135deg, hsl(215, 70%, 45%) 0%, hsl(225, 60%, 40%) 100%)`,
        backgroundSize: "12px 12px, 100% 100%",
      },
      "linen": {
        background: `linear-gradient(135deg, hsl(215, 60%, 45%) 0%, hsl(225, 55%, 40%) 100%)`,
      },
      "branded": {
        background: `linear-gradient(135deg, hsl(215, 85%, 50%) 0%, hsl(200, 75%, 45%) 100%)`,
      },
    };
    return patternMap[value] || patternMap["geometric"];
  }
  
  // Default gradient
  return { background: "linear-gradient(135deg, hsl(215, 85%, 45%) 0%, hsl(245, 70%, 50%) 100%)" };
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
  return (
    <div className="space-y-6">
      {/* Background Type Selection */}
      <RadioGroup
        value={backgroundType}
        onValueChange={onTypeChange}
        className="grid grid-cols-3 gap-3"
      >
        <Label
          htmlFor="type-image"
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
            backgroundType === "image" 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50"
          )}
        >
          <RadioGroupItem value="image" id="type-image" className="sr-only" />
          <Image className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Upload Image</span>
        </Label>
        
        <Label
          htmlFor="type-gradient"
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
            backgroundType === "gradient" 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50"
          )}
        >
          <RadioGroupItem value="gradient" id="type-gradient" className="sr-only" />
          <Palette className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Gradient</span>
        </Label>
        
        <Label
          htmlFor="type-pattern"
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
            backgroundType === "pattern" 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50"
          )}
        >
          <RadioGroupItem value="pattern" id="type-pattern" className="sr-only" />
          <Grid3X3 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Pattern</span>
        </Label>
      </RadioGroup>

      {/* Image Upload Section */}
      {backgroundType === "image" && (
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">
            Recommended size: 1800×600px (JPG or PNG)
          </Label>
          
          {headerImageUrl ? (
            <div className="relative rounded-lg overflow-hidden">
              <img 
                src={headerImageUrl} 
                alt="Header background" 
                className="w-full h-32 object-cover"
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
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
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
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload header image</span>
                </>
              )}
            </label>
          )}
        </div>
      )}

      {/* Gradient Selection */}
      {backgroundType === "gradient" && (
        <div className="grid grid-cols-3 gap-3">
          {GRADIENTS.map((gradient) => (
            <button
              key={gradient.id}
              type="button"
              onClick={() => onValueChange(gradient.id)}
              className={cn(
                "relative h-16 rounded-lg overflow-hidden border-2 transition-all",
                gradient.class,
                backgroundValue === gradient.id 
                  ? "border-foreground ring-2 ring-primary ring-offset-2" 
                  : "border-transparent hover:border-foreground/30"
              )}
            >
              {backgroundValue === gradient.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="absolute bottom-1 left-2 text-[10px] text-white/90 font-medium drop-shadow-sm">
                {gradient.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Pattern Selection */}
      {backgroundType === "pattern" && (
        <div className="grid grid-cols-3 gap-3">
          {PATTERNS.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onValueChange(pattern.id)}
              className={cn(
                "relative h-16 rounded-lg overflow-hidden border-2 transition-all flex items-center justify-center",
                "bg-gradient-to-br from-primary/80 to-primary",
                backgroundValue === pattern.id 
                  ? "border-foreground ring-2 ring-primary ring-offset-2" 
                  : "border-transparent hover:border-foreground/30"
              )}
            >
              {backgroundValue === pattern.id && (
                <div className="absolute top-1 right-1">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="text-white/90 text-lg font-mono">{pattern.preview}</span>
              <span className="absolute bottom-1 left-2 text-[10px] text-white/90 font-medium">
                {pattern.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Preview</Label>
        <div 
          className="h-24 rounded-lg overflow-hidden flex items-center justify-center"
          style={getHeaderBackgroundStyle(backgroundType, backgroundValue, headerImageUrl)}
        >
          <span className="text-white font-semibold text-lg drop-shadow-md">Your Header Preview</span>
        </div>
      </div>
    </div>
  );
};

export default HeaderBackgroundSelector;
