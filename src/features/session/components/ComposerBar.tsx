import { Paperclip, ArrowUp } from "lucide-react";
import type { ComposerTargetMode } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface ComposerBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (mode: ComposerTargetMode) => void;
}

// Minimal target definitions kept natively by logic

export function ComposerBar({
  value,
  onChange,
  onSend,
}: ComposerBarProps) {
  // We determine the mode directly from state
  // const [sendToAll, setSendToAll] = useState(false); // Removed sendToAll logic

  return (
    <div className="w-full relative flex items-end gap-2 p-1.5 bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.16)] focus-within:ring-2 focus-within:ring-primary/20 rounded-[1.5rem] border border-border/30">

      {/* Attachment Button */}
      <button
        className="flex-shrink-0 p-3 h-12 w-12 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
        type="button"
        aria-label="Attach File"
        title="添加附件或上下文"
      >
        <Paperclip size={20} />
      </button>

      {/* Text Area */}
      <textarea
        className="flex-1 max-h-[40vh] min-h-[48px] p-3 py-3.5 bg-transparent border-none resize-none outline-none text-[15px] placeholder:text-muted-foreground/60 scrollbar-hide"
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (value.trim().length > 0) {
              onSend("selected");
            }
          }
        }}
        placeholder="给 Agent 发送指令 (Enter 发送，Shift+Enter 换行)"
        rows={Math.min(5, Math.max(1, value.split("\n").length))}
        value={value}
      />

      {/* Send Action */}
      <button
        className={cn(
          "flex-shrink-0 p-3 h-12 w-12 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/50",
          value.trim().length > 0
            ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            : "bg-transparent text-muted-foreground/30 cursor-not-allowed"
        )}
        disabled={value.trim().length === 0}
        onClick={() => {
          onSend("selected"); // Always send to "selected"
          // setSendToAll(false); // Removed sendToAll logic
        }}
        type="button"
        title="发送指令"
      >
        <ArrowUp strokeWidth={2.5} size={20} />
      </button>
    </div>
  );
}
