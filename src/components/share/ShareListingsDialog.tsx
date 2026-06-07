/**
 * Universal Share Listings Dialog
 * Single source of truth for all share listing modals across the app.
 * Used by: ListingSearchResults, HotSheetReview, PropertyDetail, MyListings, etc.
 */
import * as React from "react";
import { Check, Home, Mail, Search, Send, User, Layers, Plus, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { ListingPreviewCard } from "@/components/share/ListingPreviewCard";

export type ListingPreview = {
  address: string;
  cityStateZip?: string;
  price?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  photoUrl?: string;
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
  /** Closes the contact search dropdown (e.g. click outside the search field). */
  onDismissContactDropdown?: () => void;
  /** Opens the dropdown when the search field is focused (browse CRM contacts). */
  onContactSearchFocus?: () => void;

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

  /** Overrides default dialog title (e.g. hot sheet share). */
  shareTitle?: string;
  /** Overrides default dialog description. */
  shareDescription?: string;
  /** Overrides default personal-message suggestion chips. */
  messageChips?: string[];
  /** Hot-sheet preview uses layers icon and omits listing stats. */
  previewVariant?: "listing" | "hot-sheet";
  /** Overrides footer primary button label (default: Share / Share (n)). */
  submitButtonLabel?: string;
  /** Logged-in users: sender identity comes from profile; hide name/email fields. */
  lockSenderIdentity?: boolean;
};

const DEFAULT_MESSAGE_CHIPS = [
  "Thought this might be a great fit for you.",
  "Want to schedule a quick showing?",
  "Happy to answer any questions.",
];

const CONTACT_ADD_FEEDBACK_MS = 2800;

/** Passive field / preview icons — monochrome modal chrome */
const ICON_NEUTRAL = "text-neutral-400";
const ICON_SLOT = "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2";
/** Wraps inputs so Lucide icons inherit neutral stroke (not primary focus blue) */
const FIELD_ICON_WRAP = "relative text-neutral-400";

const INPUT_CLASS =
  "border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-visible:!border-neutral-300 focus-visible:ring-1 focus-visible:!ring-neutral-200/70 focus-visible:ring-offset-0";

type ContactAddFeedback = "added" | "already-added" | null;

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
  onDismissContactDropdown,
  onContactSearchFocus,

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

  message,
  setMessage,

  canSubmit,
  submitting,
  onSubmit,

  onSaveContact,
  recipients = [],
  onAddRecipient,
  onRemoveRecipient,
  shareTitle,
  shareDescription,
  messageChips = DEFAULT_MESSAGE_CHIPS,
  previewVariant = "listing",
  submitButtonLabel,
  lockSenderIdentity = false,
}: ShareListingsDialogProps) {
  const [selectedChips, setSelectedChips] = React.useState<Set<string>>(new Set());
  const [showSavePrompt, setShowSavePrompt] = React.useState(false);
  const [lastSavedEmail, setLastSavedEmail] = React.useState<string>("");
  const [contactAddFeedback, setContactAddFeedback] = React.useState<ContactAddFeedback>(null);
  const [highlightedRecipientEmail, setHighlightedRecipientEmail] = React.useState<string | null>(null);
  const [senderExpanded, setSenderExpanded] = React.useState(false);
  const contactSearchRef = React.useRef<HTMLDivElement>(null);

  const contactDisplayName = (contact: ContactSearchResult) =>
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.email;

  const isDuplicateRecipientEmail = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return true;
    return (
      recipients.some((r) => r.email.trim().toLowerCase() === normalized) ||
      recipientEmail.trim().toLowerCase() === normalized
    );
  };

  const tryAddRecipient = (name: string, email: string): boolean => {
    if (!onAddRecipient) return false;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || isDuplicateRecipientEmail(trimmedEmail)) return false;
    onAddRecipient({ name: trimmedName, email: trimmedEmail });
    return true;
  };

  const clearPendingRecipientFields = () => {
    setRecipientName("");
    setRecipientEmail("");
    setShowSavePrompt(false);
    setContactQuery("");
    setManualMode(false);
    onDismissContactDropdown?.();
  };

  const showContactAddFeedback = (kind: Exclude<ContactAddFeedback, null>, email?: string) => {
    setContactAddFeedback(kind);
    if (kind === "already-added" && email) {
      setHighlightedRecipientEmail(email.trim().toLowerCase());
    } else {
      setHighlightedRecipientEmail(null);
    }
  };

  const handleContactSelect = (contact: ContactSearchResult) => {
    const email = contact.email?.trim();
    if (!email) return;

    const name = contactDisplayName(contact);

    if (onAddRecipient) {
      if (tryAddRecipient(name, email)) {
        showContactAddFeedback("added");
        clearPendingRecipientFields();
      } else if (isDuplicateRecipientEmail(email)) {
        showContactAddFeedback("already-added", email);
        setContactQuery("");
        onDismissContactDropdown?.();
      } else {
        setContactQuery("");
        onDismissContactDropdown?.();
      }
      return;
    }

    onSelectContact?.(contact);
    setContactQuery("");
    onDismissContactDropdown?.();
  };

  const handleManualAddRecipient = () => {
    if (tryAddRecipient(recipientName, recipientEmail)) {
      clearPendingRecipientFields();
    }
  };

  // Reset save prompt when recipient changes
  React.useEffect(() => {
    if (recipientEmail !== lastSavedEmail) {
      setShowSavePrompt(false);
    }
  }, [recipientEmail, lastSavedEmail]);

  React.useEffect(() => {
    if (!contactAddFeedback) return;
    const timer = window.setTimeout(() => {
      setContactAddFeedback(null);
      setHighlightedRecipientEmail(null);
    }, CONTACT_ADD_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [contactAddFeedback]);

  React.useEffect(() => {
    if (!open) {
      setContactAddFeedback(null);
      setHighlightedRecipientEmail(null);
      setSenderExpanded(false);
    }
  }, [open]);

  // Dismiss contact dropdown when clicking outside the search area (ref must live inside portaled dialog).
  React.useEffect(() => {
    if (!open || !showContactDropdown || !onDismissContactDropdown) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (contactSearchRef.current?.contains(target)) return;
      onDismissContactDropdown();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, showContactDropdown, onDismissContactDropdown]);

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
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-[0_4px_24px_rgba(0,0,0,0.08)] sm:max-w-xl [&>button.absolute]:rounded-md [&>button.absolute]:text-neutral-700 [&>button.absolute]:transition-colors [&>button.absolute]:data-[state=open]:bg-white [&>button.absolute]:hover:bg-neutral-100 [&>button.absolute_svg]:text-neutral-700"
        hideCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5">
          <DialogHeader className="space-y-0.5 pr-8">
            <DialogTitle className="text-base font-semibold tracking-tight text-neutral-900 sm:text-[17px]">
              {shareTitle ?? `Share Listing${selectedCount === 1 ? "" : "s"}`}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-snug text-neutral-600">
              {shareDescription ??
                `Send ${selectedCount === 1 ? "this listing" : `${selectedCount} listings`} to a contact via email.`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body - scrollable */}
        <div
          className={cn(
            "min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-4 py-3 sm:px-5",
            submitting && "pointer-events-none opacity-[0.88]",
          )}
        >
          {/* Listing preview / bulk summary */}
          {selectedCount === 1 && listingPreview ? (
            <ListingPreviewCard preview={listingPreview} />
          ) : selectedCount > 1 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div
                className={cn(
                  "flex h-16 w-[4.5rem] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50",
                  ICON_NEUTRAL,
                )}
              >
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-neutral-900">Sharing {selectedCount} listings</div>
                <div className="text-[12px] text-neutral-600">From your current selection</div>
              </div>
            </div>
          ) : null}

          {/* Contact Search */}
          <section className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {recipients.length > 0 ? "Add another contact" : "Search contact"}
            </div>

            <div ref={contactSearchRef} className={FIELD_ICON_WRAP}>
              <Search className={ICON_SLOT} />
              <Input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                onFocus={onContactSearchFocus}
                placeholder="Search by name or email…"
                className={cn("h-9 rounded-lg pl-9 text-[13px] text-neutral-900 placeholder:text-neutral-400", INPUT_CLASS)}
                autoFocus
              />
              {showContactDropdown && contactResults.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
                  {contactResults.map((contact) => {
                    const fullName = contactDisplayName(contact);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleContactSelect(contact)}
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

            {!manualMode ? (
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="text-[13px] font-medium text-[#0E56F5] transition-colors hover:text-[#0B46CC]"
              >
                + Enter recipient manually
              </button>
            ) : null}

            {(contactAddFeedback || recipients.length > 0) && (
              <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 px-2.5 py-2">
                {contactAddFeedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] leading-snug",
                      contactAddFeedback === "added"
                        ? "border-emerald-200/90 bg-emerald-50/80 text-emerald-900"
                        : "border-neutral-200 bg-white text-neutral-700",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        contactAddFeedback === "added" ? "text-emerald-600" : "text-neutral-500",
                      )}
                      aria-hidden
                    />
                    <span>
                      {contactAddFeedback === "added" ? "Contact added" : "Contact already added"}
                    </span>
                  </div>
                )}

                {recipients.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Recipients ({recipients.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recipients.map((r, idx) => {
                        const isHighlighted =
                          highlightedRecipientEmail != null &&
                          r.email.trim().toLowerCase() === highlightedRecipientEmail;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors duration-300",
                              isHighlighted
                                ? "border-emerald-300/90 bg-emerald-50/90 ring-1 ring-emerald-200/70"
                                : "border-neutral-200 bg-white",
                            )}
                          >
                            <span className="truncate text-neutral-900">{r.name}</span>
                            <span className="max-w-[9rem] truncate text-[11px] text-neutral-500">({r.email})</span>
                            {onRemoveRecipient && (
                              <button
                                type="button"
                                onClick={() => onRemoveRecipient(idx)}
                                className="-mr-0.5 rounded-full p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-500"
                                aria-label={`Remove ${r.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {manualMode && (
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/30 p-2.5">
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-neutral-700">Recipient name</div>
                    <div className="relative">
                      <User className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", ICON_NEUTRAL)} />
                      <Input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Jane Buyer"
                        className={cn("h-9 rounded-lg pl-9 text-[13px] text-neutral-900", INPUT_CLASS)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-neutral-700">Recipient email</div>
                    <div className={FIELD_ICON_WRAP}>
                      <Mail className={ICON_SLOT} />
                      <Input
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="jane@email.com"
                        type="email"
                        autoComplete="email"
                        className={cn("h-9 rounded-lg pl-9 text-[13px] text-neutral-900", INPUT_CLASS)}
                      />
                    </div>
                  </div>
                </div>

                {recipientName.trim() && recipientEmail.trim() && onSaveContact && !showSavePrompt && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-2">
                    <div className="min-w-0 text-[12px] text-neutral-700">
                      Save <span className="font-medium text-neutral-900">{recipientName.trim()}</span> to contacts?
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onSaveContact(recipientName.trim(), recipientEmail.trim());
                          setLastSavedEmail(recipientEmail.trim());
                          setShowSavePrompt(true);
                        }}
                        className="h-7 rounded-md px-2.5 text-[12px] font-medium"
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLastSavedEmail(recipientEmail.trim());
                          setShowSavePrompt(true);
                        }}
                        className="h-7 rounded-md px-2 text-[12px] text-neutral-600 hover:bg-neutral-100"
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                )}

                {onAddRecipient && recipientName.trim() && recipientEmail.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleManualAddRecipient}
                    className="h-8 rounded-lg border-neutral-200 text-[12px] font-medium text-neutral-900 hover:bg-neutral-50"
                  >
                    <Plus className={cn("mr-1.5 h-3.5 w-3.5", ICON_NEUTRAL)} />
                    Add to recipients
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setManualMode(false);
                    setRecipientName("");
                    setRecipientEmail("");
                    setShowSavePrompt(false);
                  }}
                  className="text-[12px] text-neutral-500 transition-colors hover:text-neutral-800"
                >
                  Back to contact search
                </button>
              </div>
            )}
          </section>

          {/* Message */}
          <section className="space-y-2 rounded-lg border border-neutral-200/80 bg-white p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Personal message</div>
              <div className="text-[11px] text-neutral-400">⌘ / Ctrl + Enter to send</div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {messageChips.map((t) => {
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
              className={cn("min-h-[84px] resize-y rounded-lg text-[13px] text-neutral-900 placeholder:text-neutral-400", INPUT_CLASS)}
            />
          </section>

          {/* Sharing as — guests only; logged-in users send from their account profile */}
          {!lockSenderIdentity ? (
          <section className="rounded-lg border border-neutral-200/80 bg-neutral-50/40 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Sharing as</div>
                {!senderExpanded ? (
                  <p className="text-[13px] leading-snug text-neutral-800">
                    <span className="font-medium text-neutral-900">{senderName.trim() || "Your name"}</span>
                    {senderEmail.trim() ? (
                      <>
                        <span className="text-neutral-400"> · </span>
                        <span className="text-neutral-600">{senderEmail.trim()}</span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              {!senderExpanded ? (
                <button
                  type="button"
                  onClick={() => setSenderExpanded(true)}
                  className="shrink-0 text-[13px] font-medium text-[#0E56F5] transition-colors hover:text-[#0B46CC]"
                >
                  Edit
                </button>
              ) : null}
            </div>

            {senderExpanded ? (
              <div className="mt-2.5 space-y-2 border-t border-neutral-200/80 pt-2.5">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-700">
                    Your name <span className="text-neutral-400">*</span>
                  </div>
                  <div className={FIELD_ICON_WRAP}>
                    <User className={ICON_SLOT} />
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      aria-required
                      autoComplete="off"
                      className={cn("h-9 rounded-lg pl-9 text-[13px] text-neutral-900", INPUT_CLASS)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-700">
                    Your email <span className="text-neutral-400">*</span>
                  </div>
                  <div className={FIELD_ICON_WRAP}>
                    <Mail className={ICON_SLOT} />
                    <Input
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      aria-required
                      className={cn("h-9 rounded-lg pl-9 text-[13px] text-neutral-900", INPUT_CLASS)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSenderExpanded(false)}
                  className="text-[12px] font-medium text-[#0E56F5] transition-colors hover:text-[#0B46CC]"
                >
                  Done
                </button>
              </div>
            ) : null}
          </section>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 bg-white px-4 py-3 sm:px-5 sm:py-3.5">
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
              className="h-9 min-w-[8.5rem] rounded-lg !bg-[#0E56F5] px-4 text-[13px] font-medium !text-white hover:!bg-[#0B46CC] disabled:opacity-50"
            >
              <Send className="mr-2 h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
              <span>
                {submitting
                  ? "Sending…"
                  : (submitButtonLabel ?? `Share${selectedCount === 1 ? "" : ` (${selectedCount})`}`)}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
