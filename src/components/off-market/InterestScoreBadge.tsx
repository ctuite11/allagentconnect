import { Eye, MessageSquare, Heart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InterestScoreBadgeProps {
  views: number;
  inquiries: number;
  saves: number;
}

export function InterestScoreBadge({ views, inquiries, saves }: InterestScoreBadgeProps) {
  // Weighted interest score: inquiries are most valuable, then saves, then views
  const score = views + (inquiries * 5) + (saves * 3);
  
  const getScoreLevel = (score: number): { label: string; color: string; bgColor: string } => {
    if (score >= 50) return { label: "Hot", color: "text-red-600", bgColor: "bg-red-100" };
    if (score >= 20) return { label: "Warm", color: "text-amber-600", bgColor: "bg-amber-100" };
    if (score >= 5) return { label: "Interest", color: "text-blue-600", bgColor: "bg-blue-100" };
    return { label: "New", color: "text-slate-600", bgColor: "bg-slate-100" };
  };

  const level = getScoreLevel(score);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-help",
            level.bgColor,
            level.color
          )}>
            <TrendingUp className="h-3 w-3" />
            {level.label}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3">
          <div className="space-y-2">
            <p className="font-medium text-sm">Interest Breakdown</p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span>{views} views</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span>{inquiries} inquiries</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-3 w-3 text-muted-foreground" />
                <span>{saves} saves</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-border">
              <span className="text-xs text-muted-foreground">Score: {score}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
