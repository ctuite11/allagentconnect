import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, resolveEdgeFunctionErrorMessage } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { Mail, FileText } from "lucide-react";
import { EmailTemplateManager } from "./EmailTemplateManager";
import { EmailComposerToolbar } from "./email/EmailComposerToolbar";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Array<{ id?: string; email: string; name: string }>;
  /** Fires only after a send fully succeeds and the dialog is about to close. */
  onSent?: () => void;
}

export function BulkEmailDialog({ open, onOpenChange, recipients, onSent }: BulkEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [template, setTemplate] = useState<string>("custom");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [agentInfo, setAgentInfo] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [sendAsGroup, setSendAsGroup] = useState(false);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);

  useEffect(() => {
    loadAgentInfo();
  }, []);

  const loadAgentInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("agent_profiles")
        .select("first_name, last_name, cell_phone, phone, email")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setAgentInfo({
          name: `${data.first_name} ${data.last_name}`,
          phone: data.cell_phone || data.phone || "",
          email: data.email || user.email || "",
        });
      }
    } catch (error) {
      console.error("Error loading agent info:", error);
    }
  };

  const replaceVariables = (text: string, clientName: string): string => {
    if (!agentInfo) return text;
    
    return text
      .replace(/{client_name}/g, clientName)
      .replace(/{agent_name}/g, agentInfo.name)
      .replace(/{agent_phone}/g, agentInfo.phone)
      .replace(/{agent_email}/g, agentInfo.email);
  };

  const handleTemplateSelect = (template: any) => {
    setSubject(template.subject);
    setMessage(template.body);
  };

  const handleSend = async () => {
    const isTemplated =
      template === "early-access-update-v1" ||
      template === "early-access-update-v2" ||
        template === "founding-partner-invitation" ||
        template === "comms-center-guide" ||
        template === "join-invitation";
    if (!subject.trim() || (!isTemplated && !message.trim())) {
      toast.error(isTemplated ? "Please fill in the subject" : "Please fill in both subject and message");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to send emails");
        return;
      }

      // Replace variables for each recipient
      const personalizedRecipients = recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: replaceVariables(recipient.name, recipient.name),
      }));

      // Add agent to recipients if sendCopyToSelf is enabled
      const finalRecipients = sendCopyToSelf && agentInfo?.email
        ? [...personalizedRecipients, { email: agentInfo.email, name: agentInfo.name }]
        : personalizedRecipients;

      const personalizedSubject = subject;
      const personalizedMessage = message;

      // Regular contact email → transactional path (not paused).
      // Marketing templates → send-bulk-email (paused during deliverability recovery).
      if (template === "comms-center-guide") {
        // Comms Center guide uses its own dedicated function (enqueues via email_jobs).
        for (const recipient of personalizedRecipients) {
          const firstName = (recipient.name || "").trim().split(/\s+/)[0] || null;
          const { error } = await supabase.functions.invoke("send-comms-guide-email", {
            body: { to: [recipient.email], agentFirstName: firstName },
          });
          if (error) throw error;
        }
        toast.success(
          `Comms Center guide sent to ${personalizedRecipients.length} recipient${personalizedRecipients.length === 1 ? "" : "s"}.`,
        );
      } else if (template === "custom") {
        const transactionalRecipients = personalizedRecipients.filter(
          (r) => r.email.trim() && r.email !== agentInfo?.email,
        );

        for (const recipient of transactionalRecipients) {
          await invokeEdgeFunction("send-agent-client-email", {
            clientId: recipient.id,
            recipientEmail: recipient.email.trim(),
            recipientName: recipient.name,
            subject: personalizedSubject,
            message: personalizedMessage,
          });
        }

        if (sendCopyToSelf && agentInfo?.email) {
          await invokeEdgeFunction("send-agent-client-email", {
            recipientEmail: agentInfo.email,
            recipientName: agentInfo.name,
            subject: `[COPY] ${personalizedSubject}`,
            message: personalizedMessage,
          });
        }

        const sentCount = transactionalRecipients.length;
        toast.success(
          `Email sent to ${sentCount} recipient${sentCount === 1 ? "" : "s"}${sendCopyToSelf ? " (copy sent to you)" : ""}.`,
        );
      } else {
        const { data, error } = await supabase.functions.invoke("send-bulk-email", {
          body: {
            recipients: finalRecipients,
            subject: personalizedSubject,
            message: isTemplated ? "" : personalizedMessage,
            agentId: user.id,
            agentEmail: agentInfo?.email,
            sendAsGroup: false,
            template: isTemplated ? template : undefined,
          },
        });

        if (error) {
          throw new Error(await resolveEdgeFunctionErrorMessage(error, data));
        }

        toast.success(
          `Email sent to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}. Check analytics to track opens and clicks.`,
        );
      }

      setSubject("");
      setMessage("");
      setSendAsGroup(false);
      setSendCopyToSelf(false);
      setTemplate("custom");
      onSent?.();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error sending bulk email:", error);
      const detail =
        error instanceof Error
          ? error.message
          : await resolveEdgeFunctionErrorMessage(error);
      toast.error(detail);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription>
            Sending to {recipients.length} recipient{recipients.length > 1 ? 's' : ''}
            {!sendAsGroup && (
              <span className="block mt-1 text-xs text-muted-foreground">
                🔒 Privacy protected: Each email is sent individually - recipients won't see each other's addresses
              </span>
            )}
            {sendAsGroup && (
              <span className="block mt-1 text-xs text-muted-foreground">
                👥 Group mode: All recipients will see each other and can use "Reply All"
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose">
              <Mail className="h-4 w-4 mr-2" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Recipients</Label>
            <div className="max-h-32 overflow-y-auto p-3 rounded-md border bg-muted/30">
              {recipients.map((recipient, index) => (
                <div key={index} className="flex items-center gap-2 text-sm mb-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{recipient.name}</span>
                  <span className="text-muted-foreground">({recipient.email})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-md border bg-accent/10">
            <Label htmlFor="sendCopyToSelf" className="text-sm flex-1">
              Send a copy to myself
            </Label>
            <Switch
              id="sendCopyToSelf"
              checked={sendCopyToSelf}
              onCheckedChange={setSendCopyToSelf}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={template} onValueChange={(v) => {
              setTemplate(v);
              if (v === "early-access-update-v1") {
                setSubject((prev) => prev || "A first look inside All Agent Connect");
              }
              if (v === "early-access-update-v2") {
                setSubject((prev) => prev || "Private Listing Network - All Agent Connect");
              }
              if (v === "founding-partner-invitation") {
                setSubject((prev) => prev || "Founding Partner Invite | All Agent Connect");
              }
              if (v === "comms-center-guide") {
                setSubject((prev) => prev || "Too many emails? We've got you covered.");
              }
              if (v === "join-invitation") {
                setSubject((prev) => prev || "You\u2019re invited to join All Agent Connect");
              }
            }}>
              <SelectTrigger id="template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom message</SelectItem>
                <SelectItem value="join-invitation">Join Invitation — Invite Agent to AAC</SelectItem>
                <SelectItem value="comms-center-guide">Comms Center Guide — Reduce Email Noise</SelectItem>
                <SelectItem value="founding-partner-invitation">Founding Partner — Exclusive Invitation</SelectItem>
                <SelectItem value="early-access-update-v2">Early Access — First Look (v2, recommended)</SelectItem>
                <SelectItem value="early-access-update-v1">Early Access Update — Product Tour (5 sections, luxury sample data)</SelectItem>
              </SelectContent>
            </Select>
            {(template === "early-access-update-v1" || template === "early-access-update-v2" || template === "founding-partner-invitation" || template === "comms-center-guide" || template === "join-invitation") && (
              <p className="text-xs text-muted-foreground">
                Pre-built email featuring product screenshots and short captions. Your custom message below will be ignored.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message {template === "custom" ? "*" : "(ignored for this template)"}</Label>
            <EmailComposerToolbar
              textareaRef={messageRef}
              value={message}
              onChange={setMessage}
              uploadFolder="bulk"
            />
            <Textarea
              id="message"
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={8}
              maxLength={5000}
              disabled={template !== "custom"}
            />
            <p className="text-xs text-muted-foreground">{message.length}/5000</p>
          </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !subject.trim() || (template === "custom" && !message.trim())}>
                {sending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <EmailTemplateManager onSelectTemplate={handleTemplateSelect} />
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
