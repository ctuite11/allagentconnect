import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageComposerProps {
  onSend: (body: string) => Promise<boolean>;
  sending: boolean;
}

export function MessageComposer({ onSend, sending }: MessageComposerProps) {
  const [value, setValue] = useState("");

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const ok = await onSend(trimmed);
    if (ok) setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-neutral-200/90 bg-white px-3 py-2.5">
      <div className="flex w-full items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          aria-label="Message text"
          className="h-9 min-h-9 flex-1 rounded-xl border border-neutral-200 bg-white px-3.5 text-[13px] leading-snug text-zinc-900 shadow-none placeholder:text-zinc-400 transition-colors focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={!value.trim() || sending}
          variant="outline"
          className="h-9 shrink-0 gap-1.5 rounded-full border-zinc-900 bg-zinc-900 px-4 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800 hover:text-white hover:border-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {sending ? "…" : "Send"}
          <Send className="h-3.5 w-3.5 opacity-95" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
