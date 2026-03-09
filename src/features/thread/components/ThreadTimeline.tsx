import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Pane, ProviderProfile } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface ThreadTimelineProps {
  activePane: Pane | null;
  activeProfile: ProviderProfile | null;
  availableProfiles: ProviderProfile[];
  onChangeProvider: (provider: "claude" | "codex") => void;
  onRetryLastMessage: () => void;
  onAssignProfile: (profileId: string) => void;
  onCreateProfile: () => void;
}

export function ThreadTimeline({
  activePane,
  activeProfile,
  availableProfiles,
  onChangeProvider,
  onRetryLastMessage,
  onAssignProfile,
  onCreateProfile,
}: ThreadTimelineProps) {
  const messages = activePane?.messages ?? [];
  const isRunning = activePane?.status === "running";
  const hasUserMessages = messages.some((message) => message.role === "user");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const lastMessage = messages[messages.length - 1] ?? null;
  const retryableUserMessageId =
    lastMessage?.role === "system" && lastMessage.kind === "error" && !isRunning;
  const lastUserMessageBeforeError = retryableUserMessageId
    ? [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.id ?? null
    : null;
  const activeProfileLabel = activeProfile?.label ?? "系统登录 / 官方账号";

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [profileMenuOpen]);

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-5 lg:p-6 overflow-y-auto overflow-x-hidden space-y-6 scroll-smooth">
      {activePane && !hasUserMessages && (
        <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <strong className="text-sm font-semibold text-sky-900">
                {activePane.isDraft ? "首次发消息前可以切换 Provider 和账号" : "首次发消息前可以切换账号"}
              </strong>
              <p className="text-sm leading-6 text-sky-800/80">
                {activePane.isDraft
                  ? "当前草稿窗口在首条消息发出前，可以自由切换 Provider 和账号；发送后会自动创建真实会话。"
                  : "当前会话一旦发出第一条消息，就不再支持中途切换账号；如需换账号，请直接新建会话。"}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[340px]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                    activePane.provider === "codex"
                      ? "border-sky-300 bg-white text-sky-900"
                      : "border-sky-200 bg-white/70 text-sky-800 hover:bg-white",
                    !activePane.isDraft && "cursor-not-allowed opacity-50",
                  )}
                  disabled={!activePane.isDraft}
                  onClick={() => onChangeProvider("codex")}
                  type="button"
                >
                  Codex
                </button>
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                    activePane.provider === "claude"
                      ? "border-sky-300 bg-white text-sky-900"
                      : "border-sky-200 bg-white/70 text-sky-800 hover:bg-white",
                    !activePane.isDraft && "cursor-not-allowed opacity-50",
                  )}
                  disabled={!activePane.isDraft}
                  onClick={() => onChangeProvider("claude")}
                  type="button"
                >
                  Claude Code
                </button>
              </div>
              <div className="relative" ref={profileMenuRef}>
                <button
                  className="flex w-full items-center justify-between rounded-2xl border border-sky-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition-colors hover:bg-sky-50"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  type="button"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-sky-950">{activeProfileLabel}</div>
                    <div className="text-xs text-sky-800/70">
                      {activeProfile?.authKind === "apiKey"
                        ? "第三方 Provider"
                        : activeProfile?.authKind === "official"
                          ? "官方账号 Profile"
                          : "系统登录 / 官方账号"}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn("text-sky-700 transition-transform", profileMenuOpen && "rotate-180")}
                    size={18}
                  />
                </button>

                {profileMenuOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 rounded-2xl border border-sky-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-sky-50"
                      onClick={() => {
                        onAssignProfile("");
                        setProfileMenuOpen(false);
                      }}
                      type="button"
                    >
                      <div>
                        <div className="text-sm font-semibold text-foreground">系统登录 / 官方账号</div>
                        <div className="text-xs text-muted-foreground">复用当前机器上的 CLI 登录态</div>
                      </div>
                      {!activeProfile && <Check size={16} className="text-sky-700" />}
                    </button>

                    {availableProfiles.map((profile) => (
                      <button
                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-sky-50"
                        key={profile.id}
                        onClick={() => {
                          onAssignProfile(profile.id);
                          setProfileMenuOpen(false);
                        }}
                        type="button"
                      >
                        <div>
                          <div className="text-sm font-semibold text-foreground">{profile.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile.authKind === "apiKey"
                              ? "第三方 Provider"
                              : profile.authKind === "official"
                                ? "官方账号 Profile"
                                : "系统登录"}
                            {profile.model ? ` · ${profile.model}` : ""}
                          </div>
                        </div>
                        {activeProfile?.id === profile.id && <Check size={16} className="text-sky-700" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100"
                onClick={onCreateProfile}
                type="button"
              >
                新建 Profile
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Messages Transcript */}
      <section className="space-y-4 flex-1 pb-8">
        <div className="flex items-center justify-between">
          <strong className="text-[15px] font-semibold text-foreground">
            {activePane?.title ?? "当前激活窗口"}
          </strong>
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
            messages.map((message) => {
              const isUser = message.role === "user";
              const isSystem = message.role === "system";
              const isError = message.kind === "error";
              const isProcess =
                message.kind === "status" ||
                message.kind === "tool_call" ||
                message.kind === "tool_result";
              const isMeta = message.kind === "session_meta";

              return (
                <div
                  key={message.id}
                  className={cn(
                    "w-full flex",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  {isUser ? (
                    <div className="max-w-[78%] rounded-[20px] bg-muted px-4 py-3 text-foreground shadow-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] prose-p:my-0 prose-p:leading-relaxed prose-pre:bg-background prose-pre:text-foreground prose-code:text-primary">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.body}
                        </ReactMarkdown>
                      </div>
                      {lastUserMessageBeforeError === message.id && (
                        <div className="mt-2 flex justify-end">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                            onClick={onRetryLastMessage}
                            type="button"
                          >
                            <RotateCcw size={12} />
                            重试
                          </button>
                        </div>
                      )}
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
                    <div className="max-w-[82%] px-1 py-1.5 text-foreground">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:text-foreground prose-code:text-primary">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.body}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3 bg-muted/30 border border-dashed rounded-3xl">
              <Bot size={48} className="text-muted-foreground/50 mb-2" />
              <strong className="text-lg font-medium text-foreground">
                {activePane?.isDraft ? "这是一个空白会话窗口" : "当前窗口还没有消息"}
              </strong>
              <p className="text-sm text-muted-foreground max-w-md">
                {activePane?.isDraft
                  ? "发送第一条消息后，系统会自动创建一个新的会话并开始执行。"
                  : "从下方输入区发送第一条指令，或者先从左侧切换到另一个会话。"}
              </p>
            </div>
          )}

          {isRunning && (
            <div className="w-full flex justify-start">
              <div className="max-w-[82%] px-1 py-1.5 text-foreground">
                <div className="inline-flex items-center gap-1.5 rounded-2xl bg-muted/50 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
