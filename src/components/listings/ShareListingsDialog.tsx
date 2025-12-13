import * as React from "react";
import { Home, Mail, Phone, Search, Send, User, PencilLine, Layers } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type ListingPreview = {
  address: string;
  cityStateZip?: string;
  price?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  selectedCount: number;
  listingPreview?: ListingPreview;

  // Contact search
  contactQuery: string;
  setContactQuery: (v: string) => void;

  // Manual mode
  manualMode: boolean;
  setManualMode: (v: boolean) => void;
  recipientName: string;
  setRecipientName: (v: string) => void;
  recipientEmail: string;
  setRecipientEmail: (v: string) => void;

  // Sender
  senderName: string;
  setSenderName: (v: string) => void;
  senderEmail: string;
  setSenderEmail: (v: string) => void;
  senderPhone: string;
  setSenderPhone: (v: string) => void;

  // Message
  message: string;
  setMessage: (v: string) => void;

  // Submission
  canSubmit: boolean;
  submitting?: boolean;
  onSubmit: () => void;
};

const MESSAGE_CHIPS = [
  "Thought this might be a great fit for you.",
  "Want to schedule a quick showing?",
  "Happy to answer any questions.",
];

export function ShareListingsDialog({
  open,
  onOpenChange,

  selectedCount,
  listingPreview,

  contactQuery,
  setContactQuery,

  manualMode,
  setManualMode,
  recipientName,
  setRecipientName,
  recipientEmail,
  setRecipientEmail,

  senderName,
  setSenderName,
  senderEmail,
  setSenderEmail,
  senderPhone,
  setSenderPhone,

  message,
  setMessage,

  canSubmit,
  submitting,
  onSubmit,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (canSubmit && !submitting) onSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col p-0 sm:max-w-xl"
        hideCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="shrink-0 border-b px-6 py-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg text-primary">
              Share {selectedCount} Listing{selectedCount === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Send the selected listing{selectedCount === 1 ? "" : "s"} to a contact via email.
            </DialogDescription>
          </DialogHeader>
          {/* Accent bar */}
          <div className="mt-4 h-[2px] w-16 rounded-full bg-primary" />

          {/* Listing Preview / Summary */}
          {selectedCount === 1 && listingPreview ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-background p-3 border-l-[6px] border-l-primary">
              <div className="mt-0.5 rounded-xl border border-border bg-muted p-2">
                <Home className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{listingPreview.address}</div>
                {listingPreview.cityStateZip ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {listingPreview.cityStateZip}
                  </div>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {listingPreview.price ? <span className="font-medium text-foreground">{listingPreview.price}</span> : null}
                  {typeof listingPreview.beds === "number" ? <span>{listingPreview.beds} bd</span> : null}
                  {typeof listingPreview.baths === "number" ? <span>{listingPreview.baths} ba</span> : null}
                  {typeof listingPreview.sqft === "number" ? (
                    <span>{listingPreview.sqft.toLocaleString()} sf</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : selectedCount > 1 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-background p-3 border-l-[6px] border-l-primary">
              <div className="mt-0.5 rounded-xl border border-border bg-muted p-2">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">Sharing {selectedCount} Listings</div>
                <div className="text-xs text-muted-foreground">
                  Based on your current search criteria and filters
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Body - scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Contact Search */}
          <section className="space-y-3">
            <div className="text-sm font-medium">Search Contact</div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-9 rounded-2xl border-foreground/30 focus-visible:ring-primary"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs font-medium text-primary">OR</span>
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-2xl border-primary text-primary hover:bg-muted hover:text-primary hover:border-primary"
              onClick={() => setManualMode(!manualMode)}
            >
              <PencilLine className="mr-2 h-4 w-4" />
              Enter Manually
            </Button>

            {manualMode ? (
              <div className="grid gap-3 pt-1">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recipient Name</div>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    <Input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Jane Buyer"
                      className="pl-9 rounded-2xl border-foreground/30 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Recipient Email</div>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    <Input
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="jane@email.com"
                      className="pl-9 rounded-2xl border-foreground/30 focus-visible:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Sender Info Card */}
          <section className="rounded-2xl border border-border bg-background p-4 space-y-4 border-l-[6px] border-l-primary">
            <div className="text-sm font-semibold tracking-wide">Sender Info</div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Your Name *</div>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="pl-9 rounded-2xl border-foreground/30 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Your Email *</div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="pl-9 rounded-2xl border-foreground/30 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                Your Phone <span className="text-muted-foreground">(optional)</span>
              </div>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  onBlur={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    if (formatted && formatted !== "—") {
                      setSenderPhone(formatted);
                    }
                  }}
                  placeholder="(617) 555-0123"
                  className="pl-9 rounded-2xl border-foreground/30 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              This info appears in the email signature.
            </div>
          </section>

          {/* Message */}
          <section className="rounded-2xl border border-border bg-background p-4 space-y-3 border-l-[6px] border-l-primary">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">Personal Message</div>
              <div className="text-xs text-muted-foreground">Cmd/Ctrl + Enter to send</div>
            </div>

            <div className="flex flex-wrap gap-2">
              {MESSAGE_CHIPS.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-primary text-primary hover:bg-muted hover:text-primary hover:border-primary"
                  onClick={() => setMessage(message ? `${message}\n${t}` : t)}
                >
                  {t}
                </Button>
              ))}
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a short note…"
              className="min-h-[110px] rounded-2xl border-foreground/30 focus-visible:ring-primary"
            />
          </section>
        </div>

        {/* Footer - sticky */}
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="rounded-2xl">
                Cancel
              </Button>
            </DialogClose>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              className="rounded-2xl shadow-sm"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Sending…" : `Share Listing${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
