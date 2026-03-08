import type { Pane, SessionSummary, ThreadStats } from "../../../types/domain";

interface ThreadTimelineProps {
  activePane: Pane | null;
  activeSession: SessionSummary | null;
  projectName: string;
  isHydrating: boolean;
  threadStats: ThreadStats;
}

export function ThreadTimeline({
  activePane,
  activeSession,
  projectName,
  isHydrating,
  threadStats,
}: ThreadTimelineProps) {
  const messages = activePane?.messages ?? [];
  const providerLabel =
    activeSession?.provider === "codex" || activePane?.provider === "codex"
      ? "Codex CLI"
      : "Claude Code";
  const statusLabel = activeSession?.status ?? activePane?.status ?? "idle";

  return (
    <section className="thread-canvas">
      <article className="thread-workstream">
        <div className="thread-header-card">
          <div className="thread-header-meta">
            <span className="thread-path">{projectName}</span>
            <span className="thread-runtime">{isHydrating ? "正在同步…" : "已同步本地状态"}</span>
          </div>
          <h2>{activePane?.title ?? "Main pane"}</h2>
          <p>
            主区现在直接围绕当前激活窗口渲染。窗口切换后，消息流、运行状态和发送目标都会跟着切换。
          </p>
        </div>

        <div className="thread-summary-grid">
          <article className="thread-summary-card">
            <span>Provider</span>
            <strong>{providerLabel}</strong>
            <p>当前会话已经绑定到底层命令适配器，优先走真实 CLI。</p>
          </article>
          <article className="thread-summary-card">
            <span>状态</span>
            <strong>{statusLabel}</strong>
            <p>发送消息会写入本地状态，并在适配器返回后刷新当前会话。</p>
          </article>
          <article className="thread-summary-card">
            <span>Diff</span>
            <strong>
              +{threadStats.positive} -{threadStats.negative}
            </strong>
            <p>统计基于当前激活窗口的消息流，错误和回退会在这里反映。</p>
          </article>
        </div>
      </article>

      <div className="thread-divider">
        <span>Live transcript</span>
      </div>

      <article className="thread-transcript-card">
        <div className="thread-transcript-header">
          <strong>{activePane?.title ?? "当前激活窗口"}</strong>
          <span>{messages.length} 条消息</span>
        </div>

        <div className="thread-transcript-list">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div
                className={
                  message.role === "assistant"
                    ? "thread-message-bubble thread-message-bubble-assistant"
                    : message.kind === "error"
                      ? "thread-message-bubble thread-message-bubble-error"
                      : message.role === "system"
                        ? "thread-message-bubble thread-message-bubble-system"
                        : "thread-message-bubble thread-message-bubble-user"
                }
                key={message.id}
              >
                <div className="thread-message-badge">
                  <span>{message.role}</span>
                  <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
                </div>
                <p>{message.body}</p>
              </div>
            ))
          ) : (
            <div className="thread-empty-state">
              <strong>当前窗口还没有消息</strong>
              <p>从下方输入区发送第一条指令，或者先从左侧切换到另一个会话。</p>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
