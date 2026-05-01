import { useState } from "react";
import { Send, Paperclip, Smile } from "lucide-react";
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
    <div className="flex-shrink-0 border-t border-neutral-200 px-3 py-2">
      <div className="flex w-full items-center gap-2.5">
        <button
          type="button"
          className="shrink-0 p-1 text-zinc-600 transition-colors hover:text-zinc-700"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="shrink-0 p-1 text-zinc-600 transition-colors hover:text-zinc-700"
          title="Emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          className="h-9 min-h-9 flex-1 rounded-full border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button
          onClick={handleSend}
          disabled={!value.trim() || sending}
          className="h-8 shrink-0 gap-1.5 rounded-full px-4 text-[13px] font-semibold bg-primary text-white hover:bg-primary/90"
        >
          Send
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
