import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** ~2 lines at 13px / leading-snug; caps growth before internal scroll. */
const COMPOSER_MIN_HEIGHT_PX = 44;
const COMPOSER_MAX_HEIGHT_PX = 128;

interface MessageComposerProps {
  onSend: (body: string) => Promise<boolean>;
  sending: boolean;
  /**
   * `bottom` — sticky footer below the thread (border-top).
   * `top` — directly under the panel header on empty threads (border-bottom).
   */
  edge?: "top" | "bottom";
  /** Extra classes on the footer shell (e.g. embedded sheet bottom padding). */
  footerClassName?: string;
}

export function MessageComposer({
  onSend,
  sending,
  edge = "bottom",
  footerClassName,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, COMPOSER_MIN_HEIGHT_PX), COMPOSER_MAX_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const ok = await onSend(trimmed);
    if (ok) setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const shell = cn(
    edge === "top"
      ? "flex-shrink-0 border-b border-neutral-200/90 bg-white px-3 py-2.5"
      : "flex-shrink-0 border-t border-neutral-200/90 bg-white px-3 py-2.5",
    footerClassName,
  );

  return (
    <div className={shell}>
      <div className="flex w-full items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          aria-label="Message text"
          rows={2}
          style={{ minHeight: COMPOSER_MIN_HEIGHT_PX, maxHeight: COMPOSER_MAX_HEIGHT_PX }}
          className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-[13px] leading-snug text-zinc-900 shadow-none placeholder:text-zinc-400 transition-colors focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
        />
        <Button
          type="button"
          onClick={() => void handleSend()}
          disabled={!value.trim() || sending}
          className="h-9 shrink-0 gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        >
          {sending ? "…" : "Send"}
          <Send className="h-3.5 w-3.5 opacity-95" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
