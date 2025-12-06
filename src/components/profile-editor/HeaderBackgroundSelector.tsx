import { Label } from "@/components/ui/label";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface HeaderBackgroundSelectorProps {
  backgroundType: string;
  backgroundValue: string;
  onTypeChange: (type: string) => void;
  onValueChange: (value: string) => void;
}

// Solid Color Themes
const COLOR_THEMES = [
  { id: "directconnect-blue", name: "DirectConnect Blue", style: "linear-gradient(135deg, hsl(215, 85%, 45%) 0%, hsl(230, 70%, 50%) 100%)", preview: "bg-gradient-to-br from-blue-600 to-indigo-600" },
  { id: "charcoal", name: "Charcoal", style: "linear-gradient(135deg, hsl(0, 0%, 15%) 0%, hsl(0, 0%, 25%) 100%)", preview: "bg-gradient-to-br from-gray-900 to-gray-700" },
  { id: "navy", name: "Navy", style: "linear-gradient(135deg, hsl(215, 60%, 20%) 0%, hsl(215, 50%, 30%) 100%)", preview: "bg-gradient-to-br from-blue-950 to-blue-900" },
  { id: "slate", name: "Slate", style: "linear-gradient(135deg, hsl(215, 15%, 35%) 0%, hsl(215, 20%, 45%) 100%)", preview: "bg-gradient-to-br from-slate-700 to-slate-500" },
  { id: "graphite", name: "Graphite", style: "linear-gradient(135deg, hsl(220, 10%, 20%) 0%, hsl(220, 15%, 35%) 100%)", preview: "bg-gradient-to-br from-gray-800 to-gray-600" },
  { id: "soft-gold", name: "Soft Gold", style: "linear-gradient(135deg, hsl(40, 50%, 35%) 0%, hsl(35, 45%, 45%) 100%)", preview: "bg-gradient-to-br from-amber-700 to-yellow-600" },
  { id: "burgundy", name: "Burgundy", style: "linear-gradient(135deg, hsl(345, 50%, 30%) 0%, hsl(350, 45%, 40%) 100%)", preview: "bg-gradient-to-br from-rose-900 to-red-800" },
  { id: "royal-blue", name: "Royal Blue", style: "linear-gradient(135deg, hsl(225, 70%, 40%) 0%, hsl(230, 65%, 50%) 100%)", preview: "bg-gradient-to-br from-blue-800 to-blue-600" },
];

// Pattern Themes (8 total - Neutral Gray tones for subtlety and readability)
const PATTERN_THEMES = [
  // Minimal Patterns
  { id: "diagonal-fade", name: "Soft Diagonal Fade", style: "linear-gradient(135deg, hsl(0, 0%, 18%) 0%, hsl(0, 0%, 28%) 50%, hsl(0, 0%, 20%) 100%)", preview: "bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-800" },
  { id: "linen", name: "Linen Texture", style: "linear-gradient(135deg, hsl(0, 0%, 22%) 0%, hsl(0, 0%, 28%) 100%)", preview: "bg-gradient-to-br from-neutral-800 to-neutral-700" },
  { id: "micro-dot", name: "Micro-Dot Pattern", style: "radial-gradient(circle at 1px 1px, hsla(0, 0%, 50%, 0.15) 1px, transparent 1px), linear-gradient(135deg, hsl(0, 0%, 18%) 0%, hsl(0, 0%, 24%) 100%)", preview: "bg-gradient-to-br from-neutral-900 to-neutral-800" },
  { id: "thin-mesh", name: "Thin-Line Mesh Grid", style: "linear-gradient(90deg, hsla(0, 0%, 40%, 0.08) 1px, transparent 1px), linear-gradient(hsla(0, 0%, 40%, 0.08) 1px, transparent 1px), linear-gradient(135deg, hsl(0, 0%, 20%) 0%, hsl(0, 0%, 26%) 100%)", preview: "bg-gradient-to-br from-neutral-900 to-neutral-800" },
  // Modern Real Estate Patterns
  { id: "geometric-mesh", name: "Geometric Mesh", style: "linear-gradient(60deg, transparent 48%, hsla(0, 0%, 45%, 0.1) 48%, hsla(0, 0%, 45%, 0.1) 52%, transparent 52%), linear-gradient(-60deg, transparent 48%, hsla(0, 0%, 45%, 0.1) 48%, hsla(0, 0%, 45%, 0.1) 52%, transparent 52%), linear-gradient(135deg, hsl(0, 0%, 18%) 0%, hsl(0, 0%, 25%) 100%)", preview: "bg-gradient-to-br from-neutral-900 to-neutral-700" },
  { id: "dot-grid", name: "Dot Grid", style: "radial-gradient(circle at 4px 4px, hsla(0, 0%, 50%, 0.12) 2px, transparent 2px), linear-gradient(135deg, hsl(0, 0%, 16%) 0%, hsl(0, 0%, 22%) 100%)", preview: "bg-gradient-to-br from-neutral-900 to-neutral-800" },
  { id: "gradient-mesh", name: "Gradient Mesh Nodes", style: "radial-gradient(ellipse at 20% 30%, hsla(0, 0%, 35%, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, hsla(0, 0%, 35%, 0.15) 0%, transparent 50%), linear-gradient(135deg, hsl(0, 0%, 17%) 0%, hsl(0, 0%, 24%) 100%)", preview: "bg-gradient-to-br from-neutral-900 to-neutral-800" },
  { id: "blueprint", name: "Blueprint Linework", style: "linear-gradient(90deg, hsla(0, 0%, 45%, 0.06) 1px, transparent 1px), linear-gradient(hsla(0, 0%, 45%, 0.06) 1px, transparent 1px), linear-gradient(90deg, hsla(0, 0%, 45%, 0.03) 1px, transparent 1px) 10px 10px, linear-gradient(hsla(0, 0%, 45%, 0.03) 1px, transparent 1px) 10px 10px, linear-gradient(135deg, hsl(0, 0%, 15%) 0%, hsl(0, 0%, 22%) 100%)", preview: "bg-gradient-to-br from-neutral-950 to-neutral-900" },
];

export const getHeaderBackgroundStyle = (type: string, value: string): React.CSSProperties => {
  // Color themes
  const colorTheme = COLOR_THEMES.find(t => t.id === value);
  if (colorTheme) {
    return { background: colorTheme.style };
  }
  
  // Pattern themes
  const patternTheme = PATTERN_THEMES.find(t => t.id === value);
  if (patternTheme) {
    return { background: patternTheme.style };
  }
  
  // Default to DirectConnect Blue
  return { background: COLOR_THEMES[0].style };
};

const HeaderBackgroundSelector = ({
  backgroundType,
  backgroundValue,
  onTypeChange,
  onValueChange,
}: HeaderBackgroundSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleThemeSelect = (themeId: string, type: "color" | "pattern") => {
    onTypeChange(type);
    onValueChange(themeId);
  };

  const currentTheme = [...COLOR_THEMES, ...PATTERN_THEMES].find(t => t.id === backgroundValue);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-3">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-md border"
            style={getHeaderBackgroundStyle(backgroundType, backgroundValue)}
          />
          <div className="text-left">
            <p className="text-sm font-medium">Header Theme</p>
            <p className="text-xs text-muted-foreground">{currentTheme?.name || "DirectConnect Blue"}</p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 pt-2">
        {/* Solid Colors */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Solid Colors</Label>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeSelect(theme.id, "color")}
                className={cn(
                  "relative h-12 rounded-lg overflow-hidden border-2 transition-all",
                  theme.preview,
                  backgroundValue === theme.id
                    ? "border-primary ring-2 ring-primary/30" 
                    : "border-transparent hover:border-foreground/30"
                )}
                title={theme.name}
              >
                {backgroundValue === theme.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Check className="h-4 w-4 text-white drop-shadow-md" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Patterns */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Patterns</Label>
          <div className="grid grid-cols-4 gap-2">
            {PATTERN_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeSelect(theme.id, "pattern")}
                className={cn(
                  "relative h-14 rounded-lg overflow-hidden border-2 transition-all",
                  theme.preview,
                  backgroundValue === theme.id
                    ? "border-primary ring-2 ring-primary/30" 
                    : "border-transparent hover:border-foreground/30"
                )}
              >
                {backgroundValue === theme.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Check className="h-4 w-4 text-white drop-shadow-md" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-white text-[10px] font-medium text-center">{theme.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div 
            className="h-16 rounded-lg overflow-hidden flex items-center justify-center"
            style={getHeaderBackgroundStyle(backgroundType, backgroundValue)}
          >
            <span className="text-white font-semibold drop-shadow-md text-sm">Header Preview</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default HeaderBackgroundSelector;
