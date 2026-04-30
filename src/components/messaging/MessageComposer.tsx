import { useState } from "react";
import { Send, Paperclip, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { messagingChatColumnClass } from "./chatColumnClasses";

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
    <div className="flex-shrink-0 border-t border-zinc-300 px-6 py-3">
      <div className={cn("flex items-center gap-3", messagingChatColumnClass)}>
        <button
          type="button"
          className="p-1.5 text-zinc-600 hover:text-zinc-700 transition-colors"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 text-zinc-600 hover:text-zinc-700 transition-colors"
          title="Emoji"
        >
          <Smile className="w-4 h-4" />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          className="flex-1 h-10 rounded-full bg-white border border-zinc-300 px-4 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
        />
        <Button
          onClick={handleSend}
          disabled={!value.trim() || sending}
          className="h-9 px-5 rounded-full font-semibold text-[13px] gap-1.5 bg-primary hover:bg-primary/90 text-white"
        >
          Send
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
