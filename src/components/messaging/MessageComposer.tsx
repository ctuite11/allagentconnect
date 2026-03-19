import { useState } from "react";
import { Send, Paperclip } from "lucide-react";
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
    <div className="border-t border-zinc-200 p-4 flex items-center gap-2">
      <button
        type="button"
        className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
        title="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </button>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="flex-1 h-12 rounded-xl bg-zinc-50 border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
      />
      <Button
        onClick={handleSend}
        disabled={!value.trim() || sending}
        className="h-11 px-4 bg-primary hover:bg-primary/90 rounded-xl font-medium"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
