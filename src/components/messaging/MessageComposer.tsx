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
    <div className="border-t border-zinc-100 px-6 py-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          className="flex-1 h-10 rounded-full bg-zinc-50 border border-zinc-200 px-4 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
        />
        <Button
          onClick={handleSend}
          disabled={!value.trim() || sending}
          size="sm"
          className="h-9 px-5 rounded-full font-semibold text-[13px] gap-1.5"
        >
          Send
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
