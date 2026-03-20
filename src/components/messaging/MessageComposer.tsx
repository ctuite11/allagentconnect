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
    <div className="border-t border-zinc-200 px-5 py-4 flex-shrink-0">
      <div className="mb-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message here..."
          className="w-full h-11 rounded-xl bg-zinc-50 border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
            title="Emoji"
          >
            <Smile className="w-[18px] h-[18px]" />
          </button>
        </div>
        <Button
          onClick={handleSend}
          disabled={!value.trim() || sending}
          className="h-9 px-5 bg-primary hover:bg-primary/90 rounded-full font-semibold text-sm"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
