import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Copy, 
  RefreshCw, 
  ExternalLink, 
  Mail, 
  Calendar, 
  Users,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Campaign {
  id: string;
  subject: string;
  message: string;
  sent_at: string;
  recipient_count: number;
  opens?: number;
  clicks?: number;
  unique_opens?: number;
  unique_clicks?: number;
}

interface EmailDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
  onResend?: () => void;
}

export function EmailDetailDrawer({ 
  open, 
  onOpenChange, 
  campaign,
  onResend 
}: EmailDetailDrawerProps) {
  if (!campaign) return null;

  const handleCopyContent = () => {
    const content = `Subject: ${campaign.subject}\n\n${campaign.message}`;
    navigator.clipboard.writeText(content);
    toast.success("Email content copied to clipboard");
  };

  const handleOpenMailClient = () => {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(campaign.subject)}&body=${encodeURIComponent(campaign.message)}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">Email Details</SheetTitle>
          <SheetDescription className="text-left">
            View the details of this sent email
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meta Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Sent:</span>
              <span className="font-medium">
                {format(new Date(campaign.sent_at), "MMMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Recipients:</span>
              <Badge variant="secondary">{campaign.recipient_count}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Status:</span>
              <Badge 
                variant="outline" 
                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
              >
                Sent
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Subject */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Subject</label>
            <p className="mt-1 text-foreground font-medium">{campaign.subject}</p>
          </div>

          {/* Message Body */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Message</label>
            <div className="mt-2 p-4 bg-muted/50 rounded-lg border">
              <div 
                className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: campaign.message }}
              />
            </div>
          </div>

          {/* Analytics */}
          {(campaign.unique_opens !== undefined || campaign.unique_clicks !== undefined) && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">Performance</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg border text-center">
                    <div className="text-2xl font-bold">{campaign.unique_opens || 0}</div>
                    <div className="text-xs text-muted-foreground">Opens</div>
                    {campaign.recipient_count > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {((campaign.unique_opens || 0) / campaign.recipient_count * 100).toFixed(1)}% rate
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg border text-center">
                    <div className="text-2xl font-bold">{campaign.unique_clicks || 0}</div>
                    <div className="text-xs text-muted-foreground">Clicks</div>
                    {campaign.recipient_count > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {((campaign.unique_clicks || 0) / campaign.recipient_count * 100).toFixed(1)}% rate
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Reply Notice */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Replies to this email will go directly to your inbox, not to DirectConnectMLS.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              onClick={handleCopyContent}
              className="w-full justify-start"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Content
            </Button>
            <Button 
              variant="outline" 
              onClick={handleOpenMailClient}
              className="w-full justify-start"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Mail Client
            </Button>
            {onResend && (
              <Button 
                onClick={onResend}
                className="w-full justify-start bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Send Similar Email
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
