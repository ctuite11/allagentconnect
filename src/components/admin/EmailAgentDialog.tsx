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
      template === "private-listing-network";
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

      // Single-agent listing inquiry path (non-template) uses the dedicated
      // agent-contact function so it isn't blocked by the bulk-outreach pause.
      if (!showTemplatePicker && currentBatch.length === 1) {
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
            template: isTemplated ? template : undefined,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (error) throw error;
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
        setManualRecipients([]);
        setManualEmail("");
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
                currentBatch.map((recipient) => {
                  const isManual = manualRecipients.some((m) => m.id === recipient.id);
                  return (
                    <div key={recipient.id} className="flex items-center gap-2 text-sm py-0.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{recipient.name}</span>
                      <span className="text-muted-foreground">({recipient.email})</span>
                      {isManual && (
                        <button
                          type="button"
                          onClick={() => removeManualRecipient(recipient.id)}
                          className="ml-auto text-muted-foreground hover:text-red-600"
                          aria-label="Remove recipient"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Manual add */}
            <div className="space-y-1 pt-1">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                <Input
                  id="manual-email"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addManualRecipient();
                    }
                  }}
                  placeholder="jane@example.com"
                  className="border-slate-200 h-9"
                  maxLength={255}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addManualRecipient}
                className="rounded-lg border-slate-200 h-9"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
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
                }}
              >
                <SelectTrigger id="email-template" className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom message</SelectItem>
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
                template === "private-listing-network") && (
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
