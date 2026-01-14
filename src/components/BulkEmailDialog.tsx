import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, FileText } from "lucide-react";
import { EmailTemplateManager } from "./EmailTemplateManager";

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Array<{ email: string; name: string }>;
}

export function BulkEmailDialog({ open, onOpenChange, recipients }: BulkEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
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
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
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
      const personalizedRecipients = recipients.map(recipient => ({
        email: recipient.email,
        name: replaceVariables(recipient.name, recipient.name),
      }));

      // Add agent to recipients if sendCopyToSelf is enabled
      const finalRecipients = sendCopyToSelf && agentInfo?.email
        ? [...personalizedRecipients, { email: agentInfo.email, name: agentInfo.name }]
        : personalizedRecipients;

      const personalizedSubject = subject;
      const personalizedMessage = message;

      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          recipients: finalRecipients,
          subject: personalizedSubject,
          message: personalizedMessage,
          agentId: user.id,
          agentEmail: agentInfo?.email, // Pass agent email for replyTo
          sendAsGroup: sendAsGroup && recipients.length < 5, // Only allow group mode for small groups
        },
      });

      if (error) throw error;

      const mode = sendAsGroup && recipients.length < 5 ? "group" : "individual";
      const modeText = mode === "group" ? " as a group (Reply All enabled)" : " individually (privacy protected)";
      
      const copyNote = sendCopyToSelf ? " (copy sent to you)" : "";
      toast.success(`Email sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}${modeText}${copyNote}. Check analytics to track opens and clicks.`);
      setSubject("");
      setMessage("");
      setSendAsGroup(false);
      setSendCopyToSelf(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending bulk email:", error);
      toast.error("Failed to send email: " + (error.message || "Unknown error"));
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

          {recipients.length < 5 && (
            <div className="flex items-center justify-between p-3 rounded-md border bg-accent/10">
              <Label htmlFor="sendAsGroup" className="text-sm flex-1">
                Send as group email (allow "Reply All" for collaboration)
              </Label>
              <Switch
                id="sendAsGroup"
                checked={sendAsGroup}
                onCheckedChange={setSendAsGroup}
              />
            </div>
          )}

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
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={8}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">{message.length}/5000</p>
          </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
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
