/**
 * Universal Share Listings Dialog
 * Single source of truth for all share listing modals across the app.
 * Used by: ListingSearchResults, HotSheetReview, PropertyDetail, MyListings, etc.
 */
import * as React from "react";
import { Home, Mail, Phone, Search, Send, User, PencilLine, Layers, Plus, X, UserPlus } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneFormat";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type ListingPreview = {
  address: string;
  cityStateZip?: string;
  price?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
};

export type Recipient = {
  name: string;
  email: string;
};

export type ContactSearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
};

export type ShareListingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Number of listings being shared */
  selectedCount: number;
  /** Optional preview for single listing */
  listingPreview?: ListingPreview;

  // Contact search
  contactQuery: string;
  setContactQuery: (v: string) => void;
  contactResults?: ContactSearchResult[];
  showContactDropdown?: boolean;
  onSelectContact?: (contact: ContactSearchResult) => void;

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

  // Optional: Save contact callback
  onSaveContact?: (name: string, email: string) => void;

  // Optional: Multiple recipients
  recipients?: Recipient[];
  onAddRecipient?: (recipient: Recipient) => void;
  onRemoveRecipient?: (index: number) => void;
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
  contactResults = [],
  showContactDropdown = false,
  onSelectContact,

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

  onSaveContact,
  recipients = [],
  onAddRecipient,
  onRemoveRecipient,
}: ShareListingsDialogProps) {
  const [selectedChips, setSelectedChips] = React.useState<Set<string>>(new Set());
  const [showSavePrompt, setShowSavePrompt] = React.useState(false);
  const [lastSavedEmail, setLastSavedEmail] = React.useState<string>("");

  // Reset save prompt when recipient changes
  React.useEffect(() => {
    if (recipientEmail !== lastSavedEmail) {
      setShowSavePrompt(false);
    }
  }, [recipientEmail, lastSavedEmail]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (canSubmit && !submitting) onSubmit();
    }
  };

  const handleChipClick = (chip: string) => {
    const newSelected = new Set(selectedChips);
    if (newSelected.has(chip)) {
      newSelected.delete(chip);
      // Remove from message
      const lines = message.split('\n').filter(line => line.trim() !== chip);
      setMessage(lines.join('\n'));
    } else {
      newSelected.add(chip);
      setMessage(message ? `${message}\n${chip}` : chip);
    }
    setSelectedChips(newSelected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-[0_4px_24px_rgba(0,0,0,0.08)] sm:max-w-xl [&>button.absolute]:rounded-md [&>button.absolute]:transition-colors [&>button.absolute]:data-[state=open]:bg-white [&>button.absolute]:hover:bg-neutral-100"
        hideCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-4 sm:px-5 sm:py-4">
          <DialogHeader className="space-y-1 pr-8">
            <DialogTitle className="text-base font-semibold tracking-tight text-neutral-900 sm:text-[17px]">
              Share Listing{selectedCount === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-snug text-neutral-600">
              Send {selectedCount === 1 ? "this listing" : `${selectedCount} listings`} to a contact via email.
            </DialogDescription>
            {/* Show added recipients below subtitle */}
            {(recipients.length > 0 || recipientName.trim()) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[13px]">
                <span className="text-neutral-500">To:</span>
                {recipients.map((r, idx) => (
                  <span key={idx} className="font-medium text-neutral-900">
                    {r.name}{idx < recipients.length - 1 || recipientName.trim() ? "," : ""}
                  </span>
                ))}
                {recipientName.trim() && (
                  <span className="font-medium text-neutral-900">{recipientName.trim()}</span>
                )}
              </div>
            )}
          </DialogHeader>
        </div>

        {/* Body - scrollable */}
        <div
          className={cn(
            "min-h-0 flex-1 space-y-5 overflow-y-auto bg-white px-4 py-4 sm:px-5 sm:py-5",
            submitting && "pointer-events-none opacity-[0.88]",
          )}
        >
          {/* Listing preview / bulk summary */}
          {selectedCount === 1 && listingPreview ? (
            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="mt-0.5 shrink-0 rounded-md border border-neutral-200 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <Home className="h-4 w-4 text-neutral-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900">{listingPreview.address}</div>
                {listingPreview.cityStateZip && (
                  <div className="truncate text-xs text-neutral-600">
                    {listingPreview.cityStateZip}
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
                  {listingPreview.price && <span className="font-semibold text-neutral-900">{listingPreview.price}</span>}
                  {typeof listingPreview.beds === "number" && <span>{listingPreview.beds} bd</span>}
                  {typeof listingPreview.baths === "number" && <span>{listingPreview.baths} ba</span>}
                  {typeof listingPreview.sqft === "number" && (
                    <span>{listingPreview.sqft.toLocaleString()} sf</span>
                  )}
                </div>
              </div>
            </div>
          ) : selectedCount > 1 ? (
            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="mt-0.5 shrink-0 rounded-md border border-neutral-200 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <Layers className="h-4 w-4 text-neutral-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-neutral-900">Sharing {selectedCount} listings</div>
                <div className="text-xs text-neutral-600">
                  From your current selection
                </div>
              </div>
            </div>
          ) : null}

          {/* Added Recipients */}
          {recipients.length > 0 && (
            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Recipients ({recipients.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {recipients.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <span className="truncate text-neutral-900">{r.name}</span>
                    <span className="max-w-[10rem] truncate text-xs text-neutral-500">({r.email})</span>
                    {onRemoveRecipient && (
                      <button
                        type="button"
                        onClick={() => onRemoveRecipient(idx)}
                        className="-mr-0.5 ml-0.5 rounded-full p-1 transition-colors hover:bg-neutral-100"
                        aria-label={`Remove ${r.name}`}
                      >
                        <X className="h-3 w-3 text-neutral-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contact Search */}
          <section className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {recipients.length > 0 ? "Add another contact" : "Search contact"}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-neutral-400 focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
                autoFocus
              />
              {showContactDropdown && contactResults.length > 0 && (
                <div className="absolute z-30 mt-1.5 max-h-52 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
                  {contactResults.map((contact) => {
                    const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.email;
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => onSelectContact?.(contact)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate text-[13px] font-medium text-neutral-900">{fullName}</div>
                          <div className="truncate text-xs text-neutral-600">{contact.email}</div>
                        </div>
                        {contact.phone ? (
                          <div className="shrink-0 text-xs tabular-nums text-neutral-500">
                            {formatPhoneNumber(contact.phone)}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 py-0.5">
              <Separator className="flex-1 bg-neutral-100" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">or</span>
              <Separator className="flex-1 bg-neutral-100" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full rounded-lg border-neutral-200 text-[13px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-neutral-300 hover:bg-neutral-50"
              onClick={() => setManualMode(!manualMode)}
            >
              <PencilLine className="mr-2 h-3.5 w-3.5" />
              Enter manually
            </Button>

            {manualMode && (
              <div className="space-y-3 pt-1">
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-neutral-700">Recipient name</div>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                      <Input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Jane Buyer"
                        className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-neutral-700">Recipient email</div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                      <Input
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="jane@email.com"
                        type="email"
                        autoComplete="email"
                        className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
                      />
                    </div>
                  </div>
                </div>

                {/* Save to Contacts Prompt */}
                {recipientName.trim() && recipientEmail.trim() && onSaveContact && !showSavePrompt && (
                  <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md border border-neutral-200 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        <UserPlus className="h-4 w-4 text-neutral-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium leading-snug text-neutral-900">
                          Save &quot;{recipientName.trim()}&quot; to My Contacts?
                        </div>
                        <div className="mt-0.5 truncate text-xs text-neutral-600">
                          {recipientEmail.trim()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onSaveContact(recipientName.trim(), recipientEmail.trim());
                          setLastSavedEmail(recipientEmail.trim());
                          setShowSavePrompt(true);
                        }}
                        className="h-8 rounded-md bg-neutral-900 px-3 text-[13px] font-medium text-white hover:bg-neutral-800"
                      >
                        Save to My Contacts
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLastSavedEmail(recipientEmail.trim());
                          setShowSavePrompt(true);
                        }}
                        className="h-8 rounded-md text-[13px] text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        No thanks
                      </Button>
                    </div>
                  </div>
                )}

                {/* Add Another Contact Button with tooltip */}
                {onAddRecipient && recipientName.trim() && recipientEmail.trim() && (
                  <div className="group relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onAddRecipient({ name: recipientName.trim(), email: recipientEmail.trim() });
                        setRecipientName("");
                        setRecipientEmail("");
                        setShowSavePrompt(false);
                      }}
                      className="h-8 rounded-lg border-neutral-200 text-[13px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Add another contact
                    </Button>
                    <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden rounded-md border border-neutral-200 bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] group-hover:block">
                      Multiple recipients receive the same message
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Sender Info */}
          <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sender</div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-neutral-700">Your name <span className="text-neutral-400">*</span></div>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  aria-required
                  className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-neutral-700">Your email <span className="text-neutral-400">*</span></div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  aria-required
                  className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-neutral-700">
                Your phone <span className="font-normal text-neutral-500">(optional)</span>
              </div>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  onBlur={() => {
                    const formatted = formatPhoneNumber(senderPhone);
                    if (formatted && formatted !== "—") {
                      setSenderPhone(formatted);
                    }
                  }}
                  placeholder="(617) 555-0123"
                  className="h-9 rounded-lg border-neutral-200 bg-white pl-9 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
                />
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-neutral-500">
              Shown in the email signature your contact receives.
            </p>
          </section>

          {/* Message */}
          <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Personal message</div>
              <div className="text-[11px] text-neutral-400">⌘ / Ctrl + Enter to send</div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_CHIPS.map((t) => {
                const chipOn = selectedChips.has(t);
                return (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 rounded-full px-3 text-[12px] font-normal transition-colors",
                      chipOn
                        ? "border-neutral-900/25 bg-neutral-900/[0.06] text-neutral-900"
                        : "border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                    )}
                    onClick={() => handleChipClick(t)}
                  >
                    {t}
                  </Button>
                );
              })}
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a short note…"
              className="min-h-[100px] resize-y rounded-lg border-neutral-200 bg-white text-[13px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-neutral-400 focus-visible:border-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-200/80"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:px-5 sm:py-3.5">
          <div className="min-h-0 flex-1 sm:flex sm:max-w-[55%] sm:items-center">
            {!canSubmit && !submitting ? (
              <p className="text-[11px] leading-snug text-neutral-600">
                Add a recipient email (or pick a contact) and complete sender fields.
              </p>
            ) : submitting ? (
              <p className="text-[11px] leading-snug text-neutral-600">Sending your message…</p>
            ) : null}
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm" disabled={submitting} className="h-9 rounded-lg text-[13px] text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">
                Cancel
              </Button>
            </DialogClose>

            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              className="h-9 min-w-[8.5rem] rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:hover:bg-neutral-200"
            >
              <Send className="mr-2 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{submitting ? "Sending…" : `Share${selectedCount === 1 ? "" : ` (${selectedCount})`}`}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
