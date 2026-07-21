import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailComposerToolbar } from "@/components/email/EmailComposerToolbar";
import { supabase } from "@/integrations/supabase/client";
import { useSenderProfilePrefill } from "@/lib/currentSenderProfile";
import { toast } from "sonner";
import { Loader2, Mail, Users, ChevronLeft, ChevronRight } from "lucide-react";

interface EmailAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Array<{ id: string; email: string; name: string }>;
  /** Pre-fills subject when the dialog opens (e.g. listing address). */
  defaultSubject?: string;
  /** Hide admin-only templates (agent listing contact from result cards). */
  showTemplatePicker?: boolean;
}

export function EmailAgentDialog({
  open,
  onOpenChange,
  recipients,
  defaultSubject,
  showTemplatePicker = true,
}: EmailAgentDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [template, setTemplate] = useState<string>("custom");
  const [batchSize, setBatchSize] = useState<string>("all"); // "all" | "250" | "500" | "1000"
  const [batchIndex, setBatchIndex] = useState<number>(0); // 0-based
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const applySender = useCallback((sender: { name: string; email: string }) => {
    setSenderName((prev) => sender.name || prev);
    setSenderEmail((prev) => sender.email || prev);
  }, []);

  useSenderProfilePrefill(open, applySender, "agent");

  useEffect(() => {
    if (open && defaultSubject?.trim()) {
      setSubject(defaultSubject.trim());
    }
  }, [open, defaultSubject]);

  // Reset batch index when recipients or size change
  useEffect(() => {
    setBatchIndex(0);
  }, [batchSize, recipients.length]);

  const allRecipients = recipients;
  const sizeNum = batchSize === "all" ? allRecipients.length : parseInt(batchSize, 10);
  const totalBatches = sizeNum > 0 ? Math.max(1, Math.ceil(allRecipients.length / sizeNum)) : 1;
  const safeBatchIndex = Math.min(batchIndex, totalBatches - 1);
  const start = safeBatchIndex * sizeNum;
  const end = Math.min(start + sizeNum, allRecipients.length);
  const currentBatch = allRecipients.slice(start, end);

  const handleSend = async () => {
    const isTemplated =
      template === "early-access-update-v1" ||
      template === "early-access-update-v2" ||
      template === "founding-partner-invitation" ||
      template === "private-listing-network" ||
      template === "comms-center-guide";
    if (!subject.trim() || (!isTemplated && !message.trim())) {
      toast.error("Please fill in both subject and message");
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const user = sessionData.session?.user;

      if (!accessToken || !user) {
        toast.error("Please sign in again", {
          description: "Your session expired. Sign in again before sending this email.",
        });
        return;
      }

      // Comms Center guide uses its own dedicated function which enqueues
      // via email_jobs (bypasses the bulk-outreach pause).
      if (template === "comms-center-guide") {
        for (const recipient of currentBatch) {
          const firstName = (recipient.name || "").trim().split(/\s+/)[0] || null;
          const { error } = await supabase.functions.invoke("send-comms-guide-email", {
            body: { to: [recipient.email], agentFirstName: firstName },
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (error) throw error;
        }
      } else {
      // Single-agent custom message path uses the dedicated agent-contact
      // function so it isn't blocked by the bulk-outreach pause.
      const isSingleCustom =
        currentBatch.length === 1 && (!isTemplated) && template === "custom";
      if ((!showTemplatePicker && currentBatch.length === 1) || isSingleCustom) {
        const recipient = currentBatch[0];
        const { error } = await supabase.functions.invoke("send-agent-profile-contact", {
          body: {
            agentEmail: recipient.email,
            agentName: recipient.name,
            senderName: senderName.trim() || user.email?.split("@")[0] || "All Agent Connect",
            senderEmail: senderEmail.trim() || user.email || "",
            message: message.trim(),
            subject: subject.trim(),
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("send-bulk-email", {
          body: {
            recipients: currentBatch.map((r) => ({ email: r.email, name: r.name })),
            subject: subject.trim(),
            message: isTemplated ? "" : message.trim(),
            agentId: user.id,
            agentEmail: senderEmail.trim() || undefined,
            sendAsGroup: false,
            template: isTemplated
              ? template
              : template === "profile-reminder"
                ? "profile-reminder"
                : undefined,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (error) throw error;
      }
      }

      const sentCount = currentBatch.length;
      const hasNext = safeBatchIndex + 1 < totalBatches;
      if (batchSize !== "all" && hasNext) {
        toast.success(
          `Batch ${safeBatchIndex + 1} sent (${sentCount} recipients). Ready for batch ${safeBatchIndex + 2} of ${totalBatches}.`
        );
        setBatchIndex(safeBatchIndex + 1);
      } else {
        toast.success(`Email sent to ${sentCount} recipient${sentCount > 1 ? "s" : ""}`);
        setSubject("");
        setMessage("");
        setTemplate("custom");
        setBatchSize("all");
        setBatchIndex(0);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const isBulk = allRecipients.length > 1;
  const isBatched = batchSize !== "all" && totalBatches > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded-2xl border-slate-200 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-[#F7F6F3] border border-slate-200">
              {isBulk ? <Users className="h-5 w-5 text-slate-600" /> : <Mail className="h-5 w-5 text-slate-600" />}
            </div>
            <DialogTitle className="text-foreground">
              {isBulk ? "Email Selected Agents" : "Email Agent"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            {isBulk 
              ? isBatched
                ? `Sending to ${currentBatch.length} of ${allRecipients.length} agents (batch ${safeBatchIndex + 1} of ${totalBatches}). Each will receive a separate email.`
                : `Sending to ${allRecipients.length} agents. Each will receive a separate email.`
              : allRecipients[0]
                ? `Send an email to ${allRecipients[0].name}`
                : "Add a recipient to get started"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Batch Controls */}
          {isBulk && showTemplatePicker && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Batch</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={batchSize}
                  onValueChange={(v) => setBatchSize(v)}
                >
                  <SelectTrigger className="border-slate-200 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({allRecipients.length})</SelectItem>
                    <SelectItem value="250">Batches of 250</SelectItem>
                    <SelectItem value="500">Batches of 500</SelectItem>
                    <SelectItem value="1000">Batches of 1000</SelectItem>
                  </SelectContent>
                </Select>

                {isBatched && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-lg border-slate-200 h-9 w-9"
                      onClick={() => setBatchIndex(Math.max(0, safeBatchIndex - 1))}
                      disabled={safeBatchIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="px-2 text-sm text-slate-700 min-w-[140px] text-center">
                      Batch {safeBatchIndex + 1} of {totalBatches}
                      <div className="text-xs text-muted-foreground">
                        recipients {start + 1}–{end}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-lg border-slate-200 h-9 w-9"
                      onClick={() => setBatchIndex(Math.min(totalBatches - 1, safeBatchIndex + 1))}
                      disabled={safeBatchIndex >= totalBatches - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recipients Preview */}
          {showTemplatePicker ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">
              Recipients {isBatched ? `(${currentBatch.length} in this batch)` : `(${allRecipients.length})`}
            </Label>
            <div className="max-h-32 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-[#FAFAF8]">
              {currentBatch.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">No recipients yet. Add one below.</div>
              ) : (
                currentBatch.map((recipient) => (
                  <div key={recipient.id} className="flex items-center gap-2 text-sm py-0.5">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{recipient.name}</span>
                    <span className="text-muted-foreground">({recipient.email})</span>
                  </div>
                ))
              )}
            </div>
          </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">To</Label>
              <div className="rounded-lg border border-slate-200 bg-[#FAFAF8] px-3 py-2 text-sm">
                {allRecipients[0] ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{allRecipients[0].name}</span>
                    <span className="text-muted-foreground">&lt;{allRecipients[0].email}&gt;</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">No recipient</span>
                )}
              </div>
            </div>
          )}

          {showTemplatePicker ? (
            <div className="space-y-2">
              <Label htmlFor="email-template">Template</Label>
              <Select
                value={template}
                onValueChange={(v) => {
                  setTemplate(v);
                  if (v === "profile-reminder") {
                    setSubject((prev) => prev || "Complete your All Agent Connect profile");
                    setMessage(
                      "This is a quick reminder to complete your agent profile and communication preferences on All Agent Connect.\n\n" +
                        "Agents without a completed profile do not appear in the Agent Network and will not be eligible to receive seller and buyer leads as we roll out these new features.\n\n" +
                        "Completing your profile and setting your communication preferences only takes a few minutes and ensures you can take full advantage of the network.\n\n" +
                        "Complete your profile today to make sure you're visible and eligible for new opportunities.\n\n" +
                        "Best,\n\n" +
                        "Chris\n" +
                        "All Agent Connect"
                    );
                  }
                  if (v === "early-access-update-v1") {
                    setSubject((prev) => prev || "A first look inside All Agent Connect");
                  }
                  if (v === "early-access-update-v2") {
                    setSubject((prev) => prev || "Private Listing Network - All Agent Connect");
                  }
                  if (v === "founding-partner-invitation") {
                    setSubject((prev) => prev || "Become a Founding Partner | All Agent Connect");
                  }
                  if (v === "private-listing-network") {
                    setSubject((prev) => prev || "The private listing network where agents share pre-market intelligence");
                  }
                  if (v === "comms-center-guide") {
                    setSubject((prev) => prev || "Too many emails? We\u2019ve got you covered.");
                  }
                }}
              >
                <SelectTrigger id="email-template" className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom message</SelectItem>
                  <SelectItem value="profile-reminder">
                    Complete Your Profile — Reminder
                  </SelectItem>
                  <SelectItem value="comms-center-guide">
                    Comms Center Guide — Reduce Email Noise
                  </SelectItem>
                  <SelectItem value="private-listing-network">
                    Private Listing Network — All Agents (recommended)
                  </SelectItem>
                  <SelectItem value="founding-partner-invitation">
                    Founding Partner — Exclusive Invitation
                  </SelectItem>
                  <SelectItem value="early-access-update-v2">
                    Early Access — First Look (v2, recommended)
                  </SelectItem>
                  <SelectItem value="early-access-update-v1">
                    Early Access Update — Product Tour
                  </SelectItem>
                </SelectContent>
              </Select>
              {(template === "early-access-update-v1" ||
                template === "early-access-update-v2" ||
                template === "founding-partner-invitation" ||
                template === "private-listing-network" ||
                template === "comms-center-guide") && (
                <p className="text-xs text-muted-foreground">
                  Pre-built email featuring product screenshots and short captions. Custom message below is ignored.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject *</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="border-slate-200"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-message">
              Message {template === "custom" ? "*" : "(ignored for this template)"}
            </Label>
            <Textarea
              id="email-message"
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={showTemplatePicker ? 6 : 8}
              className="border-slate-200 resize-none"
              maxLength={5000}
              disabled={template !== "custom"}
            />
            <div className="flex items-center justify-between gap-2">
              <EmailComposerToolbar
                textareaRef={messageRef}
                value={message}
                onChange={setMessage}
                uploadFolder="bulk"
              />
              <p className="text-xs text-muted-foreground">{message.length}/5000</p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !subject.trim() || (template === "custom" && !message.trim()) || allRecipients.length === 0}
            className="rounded-xl bg-[#0E56F5] hover:bg-[#0E56F5]/90 text-white"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isBatched
              ? `Send to ${currentBatch.length} (batch ${safeBatchIndex + 1} of ${totalBatches})`
              : `Send Email${isBulk ? ` to ${allRecipients.length}` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
