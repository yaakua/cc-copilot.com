import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, RotateCcw, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ConversationEvent, Pane, ProviderProfile } from "../../../types/domain";
import { cn, formatTimeAgo } from "../../../lib/utils";
import { SessionSetupBar } from "../../session/components/SessionSetupBar";
import { ClaudeIcon } from "../../../components/icons/ClaudeIcon";
import { CodexIcon } from "../../../components/icons/CodexIcon";

// H3: Group consecutive process messages
type ProcessGroup = {
  type: "process_group";
  groupIndex: number;
  messages: ConversationEvent[];
};

type TimelineItem = (ConversationEvent & { type?: undefined }) | ProcessGroup;

function groupMessages(messages: ConversationEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let groupIndex = 0;
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];
    const isProcess =
      message.kind === "status" ||
      message.kind === "tool_call" ||
      message.kind === "tool_result";

    if (isProcess) {
      const group: ConversationEvent[] = [message];
      let j = i + 1;
      while (j < messages.length) {
        const next = messages[j];
        const nextIsProcess =
          next.kind === "status" ||
          next.kind === "tool_call" ||
          next.kind === "tool_result";
        if (nextIsProcess) {
          group.push(next);
          j++;
        } else {
          break;
        }
      }
      if (group.length >= 2) {
        items.push({ type: "process_group", groupIndex: groupIndex++, messages: group });
      } else {
        items.push(message);
      }
      i = j;
    } else {
      items.push(message);
      i++;
    }
  }
  return items;
}

interface ThreadTimelineProps {
  activePane: Pane | null;
  activeProfile: ProviderProfile | null;
  availableProfiles: ProviderProfile[];
  onChangeProvider: (provider: "claude" | "codex") => void;
  onRetryLastMessage: () => void;
  onAssignProfile: (profileId: string) => void;
  onCreateProfile: () => void;
  onSuggest?: (text: string) => void;
  fullWidth?: boolean;
}

export function ThreadTimeline({
  activePane,
  activeProfile,
  availableProfiles,
  onChangeProvider,
  onRetryLastMessage,
  onAssignProfile,
  onCreateProfile,
  onSuggest,
  fullWidth = false,
}: ThreadTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const messages = activePane?.messages ?? [];
  const isRunning = activePane?.status === "running";
  const hasUserMessages = messages.some((message) => message.role === "user");
  const lastMessage = messages[messages.length - 1] ?? null;
  const retryableUserMessageId =
    lastMessage?.role === "system" && lastMessage.kind === "error" && !isRunning;
  const lastUserMessageBeforeError = retryableUserMessageId
    ? [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.id ?? null
    : null;
  const scrollSignature = useMemo(
    () => messages.map((message) => `${message.id}:${message.body.length}:${message.kind}`).join("|"),
    [messages],
  );

  // H3: Track expanded process groups
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // M4: Track copied message id
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // H3: Grouped timeline items
  const timelineItems = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      bottomAnchorRef.current?.scrollIntoView({ block: "end", behavior: isRunning ? "auto" : "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activePane?.id, isRunning, scrollSignature]);

  function toggleGroup(groupIndex: number) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      return next;
    });
  }

  async function copyMessage(messageId: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  // M5: Suggestion prompts
  const suggestions = [
    "Review my code",
    "Explain this file",
    "Help me fix a bug",
  ];

  function renderMessage(message: ConversationEvent) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const isError = message.kind === "error";
    const isProcess =
      message.kind === "status" ||
      message.kind === "tool_call" ||
      message.kind === "tool_result";
    const isMeta = message.kind === "session_meta";
    const isAssistant = message.role === "assistant" && !isError && !isProcess && !isMeta;

    return (
      <div
        key={message.id}
        className={cn(
          "w-full flex",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {isUser ? (
          <div className="flex items-start gap-2 max-w-[78%] group/msg">
            {/* Action buttons on the left side of user message */}
            <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity pt-1">
              <button
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => copyMessage(message.id, message.body)}
                type="button"
                title="复制消息"
              >
                {copiedId === message.id ? (
                  <Check size={12} className="text-emerald-600" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
              {lastUserMessageBeforeError === message.id && (
                <button
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  onClick={onRetryLastMessage}
                  type="button"
                  title="重试"
                >
                  <RotateCcw size={12} />
                </button>
              )}
              <div className="text-[9px] text-muted-foreground/60 whitespace-nowrap">
                {formatTimeAgo(message.createdAt)}
              </div>
            </div>
            <div className="rounded-2xl bg-muted px-2.5 py-1.5 text-foreground shadow-sm">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-p:my-0 prose-p:leading-snug prose-pre:bg-background prose-pre:text-foreground prose-code:text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.body}
                </ReactMarkdown>
              </div>
            </div>
            {/* H2: User avatar */}
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User size={14} />
            </div>
          </div>
        ) : isError ? (
          <div className={cn(
            "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6",
            "border border-red-200 bg-red-50 text-red-700"
          )}>
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] prose-p:my-0 prose-p:leading-relaxed prose-pre:bg-background prose-pre:text-foreground prose-code:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.body}
              </ReactMarkdown>
            </div>
          </div>
        ) : isProcess ? (
          <div className="max-w-[82%] px-1 py-0.5 text-[13px] leading-6 text-muted-foreground">
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] text-muted-foreground prose-p:my-0 prose-p:leading-relaxed prose-code:text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.body}
              </ReactMarkdown>
            </div>
          </div>
        ) : isSystem || isMeta ? (
          <div className="max-w-[82%] rounded-2xl bg-orange-50/70 px-3.5 py-2.5 text-[13px] leading-6 text-orange-700">
            <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] prose-p:my-0 prose-p:leading-relaxed prose-pre:bg-background prose-pre:text-foreground prose-code:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.body}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          /* H2: Assistant message with avatar + background */
          <div className="flex items-start gap-2 max-w-[82%] group/msg">
            {/* H2: Assistant avatar */}
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
              activePane?.provider === "codex"
                ? "bg-sky-50 text-sky-600"
                : "bg-orange-50 text-orange-600"
            )}>
              {activePane?.provider === "codex" ? (
                <CodexIcon size={14} className="opacity-80" />
              ) : (
                <ClaudeIcon size={14} className="opacity-80" />
              )}
            </div>
            <div className="bg-muted/30 rounded-2xl px-2.5 py-1.5 text-foreground">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-p:my-0 prose-p:leading-snug prose-pre:bg-muted/50 prose-pre:text-foreground prose-code:text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.body}
                </ReactMarkdown>
              </div>
            </div>
            {/* Action buttons on the right side of assistant message */}
            <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity pt-1">
              {isAssistant && (
                <button
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => copyMessage(message.id, message.body)}
                  type="button"
                  title="复制消息"
                >
                  {copiedId === message.id ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              )}
              <div className="text-[9px] text-muted-foreground/60 whitespace-nowrap">
                {formatTimeAgo(message.createdAt)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderProcessGroup(group: ProcessGroup) {
    const isExpanded = expandedGroups.has(group.groupIndex);
    const toolCalls = group.messages.filter((m) => m.kind === "tool_call").length;
    const statusCount = group.messages.filter((m) => m.kind === "status").length;

    let summary = "";
    if (toolCalls > 0 && statusCount > 0) {
      summary = `${toolCalls} 个工具调用，${statusCount} 个状态更新`;
    } else if (toolCalls > 0) {
      summary = `${toolCalls} 个工具调用`;
    } else if (statusCount > 0) {
      summary = `${statusCount} 个状态更新`;
    } else {
      summary = `${group.messages.length} 个过程消息`;
    }

    return (
      <div key={`group-${group.groupIndex}`} className="w-full">
        <button
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
          onClick={() => toggleGroup(group.groupIndex)}
          type="button"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-medium">{summary}</span>
        </button>
        {isExpanded && (
          <div className="border-l-2 border-muted ml-3 pl-3 mt-1 space-y-2">
            {group.messages.map((message) => renderMessage(message))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "scrollbar-none flex h-full w-full flex-col overflow-y-auto overflow-x-hidden p-4 scroll-smooth md:p-5 lg:p-6",
        fullWidth ? "max-w-none" : "mx-auto max-w-4xl",
      )}
      ref={scrollContainerRef}
    >
      {activePane && !hasUserMessages && (
        <SessionSetupBar
          activeProfile={activeProfile}
          availableProfiles={availableProfiles}
          canSwitchProvider={!hasUserMessages}
          onAssignProfile={onAssignProfile}
          onChangeProvider={onChangeProvider}
          onCreateProfile={onCreateProfile}
          provider={activePane.provider}
        />
      )}

      {/* Messages Transcript */}
      <section className="flex-1 space-y-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-base font-semibold text-foreground">
              {activePane?.title ?? "当前激活窗口"}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                正在响应
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {messages.length} 条消息
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {messages.length > 0 ? (
            timelineItems.map((item) => {
              if (item.type === "process_group") {
                return renderProcessGroup(item);
              }
              return renderMessage(item as ConversationEvent);
            })
          ) : (
            /* M5: Improved empty state with suggestions */
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 bg-muted/30 border border-dashed rounded-2xl">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-2",
                activePane?.provider === "codex"
                  ? "bg-sky-50 text-sky-500"
                  : "bg-orange-50 text-orange-500"
              )}>
                {activePane?.provider === "codex" ? (
                  <CodexIcon size={32} className="opacity-70" />
                ) : (
                  <ClaudeIcon size={32} className="opacity-70" />
                )}
              </div>
              <strong className="text-lg font-medium text-foreground">
                {activePane?.isDraft ? "这是一个空白会话窗口" : "当前窗口还没有消息"}
              </strong>
              <p className="text-sm text-muted-foreground max-w-md">
                {activePane?.isDraft
                  ? "发送第一条消息后，系统会自动创建一个新的会话并开始执行。"
                  : "从下方输入区发送第一条指令，或者先从左侧切换到另一个会话。"}
              </p>
              {/* M5: Suggestion buttons */}
              {activePane?.isDraft && (
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      onClick={() => onSuggest?.(s)}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isRunning && (
            <div className="w-full flex justify-start">
              <div className="flex items-end gap-2">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  activePane?.provider === "codex"
                    ? "bg-sky-50 text-sky-600"
                    : "bg-orange-50 text-orange-600"
                )}>
                  {activePane?.provider === "codex" ? (
                    <CodexIcon size={14} className="opacity-80" />
                  ) : (
                    <ClaudeIcon size={14} className="opacity-80" />
                  )}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-2xl bg-muted/50 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div aria-hidden="true" ref={bottomAnchorRef} />
      </section>
    </div>
  );
}
