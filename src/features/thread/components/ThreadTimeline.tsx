import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Pane } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface ThreadTimelineProps {
  activePane: Pane | null;
}

export function ThreadTimeline({
  activePane,
}: ThreadTimelineProps) {
  const messages = activePane?.messages ?? [];
  const isRunning = activePane?.status === "running";

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-5 lg:p-6 overflow-y-auto overflow-x-hidden space-y-6 scroll-smooth">



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
              const isMeta = message.kind === "session_meta" || message.kind === "status";

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
                    </div>
                  ) : isSystem || isError || isMeta ? (
                    <div className={cn(
                      "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6",
                      isError
                        ? "border border-red-200 bg-red-50 text-red-700"
                        : "bg-orange-50/70 text-orange-700"
                    )}>
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
              <strong className="text-lg font-medium text-foreground">当前窗口还没有消息</strong>
              <p className="text-sm text-muted-foreground max-w-md">
                从下方输入区发送第一条指令，或者先从左侧切换到另一个会话。
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
