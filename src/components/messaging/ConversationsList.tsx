import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { SquarePen, Search, Trash2 } from "lucide-react";
import type { ConversationThread } from "@/hooks/useConversationThreads";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserAvatar } from "./UserAvatar";
import { buyerMessagingThreadRow } from "@/lib/buyerUi";
import { cn } from "@/lib/utils";

interface ConversationsListProps {
  threads: ConversationThread[];
  threadsLoading: boolean;
  selectedId: string | undefined;
  inboxFetchError?: string | null;
  onRetryInbox?: () => void;
  onNewMessage?: () => void;
  showNewMessageButton?: boolean;
  routeBase?: string;
  heading?: string;
  searchPlaceholder?: string;
  emptyStateLabel?: string;
  onArchiveThreads?: (conversationIds: string[]) => Promise<boolean>;
}

export function ConversationsList({
  threads,
  threadsLoading: loading,
  inboxFetchError,
  onRetryInbox,
  selectedId,
  onNewMessage,
  showNewMessageButton = true,
  routeBase = "/messages",
  heading = "Recent chats",
  searchPlaceholder = "Search name, message, or address",
  emptyStateLabel = "No conversations yet",
  onArchiveThreads,
}: ConversationsListProps) {
  const [search, setSearch] = useState("");
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (loading || threads.length === 0) return;

    const listingIds = threads
      .map((t) => t.listingId)
      .filter((id): id is string => !!id && !addressCache[id]);

    const uniqueIds = [...new Set(listingIds)];
    if (uniqueIds.length === 0) return;

    supabase
      .from("listings")
      .select("id, address, city, state")
      .in("id", uniqueIds)
      .then(({ data }) => {
        if (!data) return;
        const entries: Record<string, string> = {};
        data.forEach((l) => {
          entries[l.id] = [l.address, l.city, l.state].filter(Boolean).join(", ");
        });
        setAddressCache((prev) => ({ ...prev, ...entries }));
      });
  }, [threads, loading]);

  const totalUnread = threads.filter((t) => t.isUnread).length;

  const filtered = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.otherUserName.toLowerCase().includes(q) ||
      (t.lastMessagePreview ?? "").toLowerCase().includes(q)
    );
  });

  const visibleIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleIds));
  }, [allVisibleSelected, visibleIds]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openDeleteConfirm = useCallback((ids: string[]) => {
    if (!onArchiveThreads || ids.length === 0) return;
    setPendingDeleteIds(ids);
    setConfirmOpen(true);
  }, [onArchiveThreads]);

  const handleConfirmDelete = useCallback(async () => {
    if (!onArchiveThreads || pendingDeleteIds.length === 0) {
      setConfirmOpen(false);
      return;
    }
    setDeleting(true);
    const ok = await onArchiveThreads(pendingDeleteIds);
    setDeleting(false);
    setConfirmOpen(false);
    if (ok) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pendingDeleteIds.forEach((id) => next.delete(id));
        return next;
      });
      setPendingDeleteIds([]);
    }
  }, [onArchiveThreads, pendingDeleteIds]);

  const confirmCount = pendingDeleteIds.length;
  const canDelete = Boolean(onArchiveThreads);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-100 p-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">{heading}</h2>
            {totalUnread > 0 && (
              <span
                className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#16A34A] px-1.5 text-[10px] font-bold leading-none text-white shadow-none"
                aria-label={`${totalUnread} unread threads`}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          {showNewMessageButton && onNewMessage && (
            <button
              type="button"
              onClick={onNewMessage}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0E56F5] px-3 py-1.5 text-[13px] font-semibold text-white shadow-none transition-colors hover:bg-[#0B47CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E56F5]/40 focus-visible:ring-offset-2"
              title="New message"
            >
              <SquarePen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">New Message</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-[13px] text-zinc-900 shadow-none placeholder:text-zinc-400 transition-colors focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
          />
        </div>

      </div>

      {canDelete && selectedIds.size > 0 ? (
        <div className="flex-shrink-0 border-b border-neutral-100 bg-neutral-50/60 px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="text-[11px] font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
            >
              {allVisibleSelected ? "Clear all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={() => openDeleteConfirm([...selectedIds])}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700/90 underline-offset-2 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
            >
              <Trash2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              Delete selected ({selectedIds.size})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[11px] font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {/* Thread list */}
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2 py-2 [-webkit-overflow-scrolling:touch]">
        {loading ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-3 shadow-sm"
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-zinc-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-[min(140px,50%)] rounded-md bg-zinc-100" />
                  <Skeleton className="h-3 w-[min(200px,75%)] rounded-md bg-zinc-100/90" />
                </div>
              </div>
            ))}
          </div>
        ) : inboxFetchError ? (
          <div className="space-y-3 p-8 text-center">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-zinc-600">{inboxFetchError}</p>
            {onRetryInbox ? (
              <button
                type="button"
                onClick={() => onRetryInbox()}
                className="text-[13px] font-semibold text-[#0E56F5] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-zinc-700">{search ? "No matching threads" : emptyStateLabel}</p>
            {search ? (
              <p className="mt-1 text-[12px] text-zinc-500">Try a different name or keyword.</p>
            ) : (
              <p className="mt-1 text-[12px] text-zinc-500">Start a new chat from the button above.</p>
            )}
          </div>
        ) : (
          filtered.map((thread, idx) => {
            const isActiveThread = thread.id === selectedId;
            const isChecked = selectedIds.has(thread.id);
            const listingLine =
              thread.listingId && addressCache[thread.listingId]
                ? addressCache[thread.listingId]
                : null;
            const contextLabel = thread.listingId
              ? listingLine
                ? `Listing · ${listingLine}`
                : "Listing conversation"
              : thread.buyerNeedId
                ? "Client need thread"
                : null;

            const threadHref = `${routeBase}/${thread.id}`;
            const threadState = { from: routeBase, fromLabel: "Back to Messages" };

            return (
              <div
                key={thread.id}
                className={cn(
                  "group outline-none mb-1.5 flex items-center gap-2 rounded-xl px-2 py-3 transition-all duration-200 ease-out last:mb-0",
                  isActiveThread
                    ? "border border-neutral-200/80 bg-neutral-50 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    : cn(buyerMessagingThreadRow, idx % 2 === 1 && "bg-neutral-100"),
                  isChecked && !isActiveThread && "bg-neutral-50/80",
                )}
              >
                {canDelete ? (
                  <div
                    className="flex shrink-0 items-center pl-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => toggleSelected(thread.id, checked === true)}
                      aria-label={`Select conversation with ${thread.otherUserName}`}
                      className="h-4 w-4 rounded-[3px] border-zinc-300 bg-white hover:border-zinc-400 data-[state=checked]:border-[#16A34A] data-[state=checked]:bg-[#16A34A] [&_svg]:h-3 [&_svg]:w-3"
                    />
                  </div>
                ) : null}

                <Link
                  to={threadHref}
                  state={threadState}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <UserAvatar
                    name={thread.otherUserName}
                    headshotUrl={thread.otherUserHeadshotUrl}
                    size="lg"
                    showPresence={false}
                    isBuyer={!thread.otherUserIsAgent}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-px flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[13px]",
                          thread.isUnread
                            ? "font-bold text-zinc-900"
                            : "font-medium text-zinc-800"
                        )}
                      >
                        {thread.otherUserName}
                      </span>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {thread.unreadCount > 0 && (
                          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#16A34A] px-2 py-0.5 text-[10px] font-bold leading-none text-white shadow-none">
                            {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                          </span>
                        )}
                        <span className="text-[11px] tabular-nums text-zinc-400">
                          {formatDistanceToNow(new Date(thread.lastMessageAt), {
                            addSuffix: false,
                          })}
                        </span>
                      </div>
                    </div>
                    {thread.lastMessagePreview && (
                      <p
                        className={cn(
                          "truncate text-[12px] leading-snug",
                          thread.isUnread ? "text-zinc-600" : "text-zinc-400"
                        )}
                      >
                        {thread.lastMessageSenderId === thread.otherUserId
                          ? thread.lastMessagePreview
                          : `You: ${thread.lastMessagePreview}`}
                      </p>
                    )}
                    {contextLabel ? (
                      <p className="mt-1 truncate text-[11px] leading-snug text-zinc-400" title={contextLabel}>
                        {contextLabel}
                      </p>
                    ) : null}
                  </div>
                </Link>

                {canDelete ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDeleteConfirm([thread.id]);
                    }}
                    className={cn(
                      "mr-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 opacity-100 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 sm:opacity-0 sm:group-hover:opacity-100",
                      (isChecked || isActiveThread) && "sm:opacity-100",
                    )}
                    aria-label={`Delete conversation with ${thread.otherUserName}`}
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmCount === 1 ? "Delete conversation?" : `Delete ${confirmCount} conversations?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCount === 1
                ? "This removes the conversation from your inbox. The other person will still see it."
                : "These conversations will be removed from your inbox only. The other participants will still see them."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
