import { useEffect, useState } from "react";
import { Folder, Loader2, Plus, Settings, Bot, Terminal } from "lucide-react";

function formatTimeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    if (isNaN(diffMs)) return "";

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} 天`;
    if (diffHours > 0) return `${diffHours} 小时`;
    if (diffMins > 0) return `${diffMins} 分`;
    return "刚刚";
  } catch {
    return "";
  }
}
import type { Project, ProviderKind } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface ProjectSidebarProps {
  projects: Project[];
  activeSessionId: string | null;
  openSessionIds: Set<string>;
  openSessionCounts: Record<string, number>;
  onCreateProject: () => void;
  onCreateSessionWithOptions: (
    projectId: string,
    options: { provider: ProviderKind; profileId: string | null },
  ) => void;
  onOpenSession: (projectId: string, sessionId: string, mode?: "replace" | "split") => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteSession: (projectId: string, sessionId: string) => void;
  onOpenGlobalSettings: () => void;
}

export function ProjectSidebar({
  projects,
  activeSessionId,
  openSessionIds,
  openSessionCounts,
  onCreateProject,
  onCreateSessionWithOptions,
  onOpenSession,
  onDeleteProject,
  onDeleteSession,
  onOpenGlobalSettings,
}: ProjectSidebarProps) {
  // Track which project is showing the new session dropdown
  const [sessionPrompt, setSessionPrompt] = useState<string | null>(null);
  const [sessionMenu, setSessionMenu] = useState<{
    projectId: string;
    sessionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [sessionDeleteTarget, setSessionDeleteTarget] = useState<{
    projectId: string;
    sessionId: string;
    title: string;
  } | null>(null);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<Project | null>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = () => {
      setSessionPrompt(null);
      setSessionMenu(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <aside className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/10 pt-4">
      <div className="flex items-center justify-between px-6 mb-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">工作区</span>
        <button
          className="text-muted-foreground hover:text-foreground hover:bg-muted/80 p-1.5 rounded-md transition-colors"
          onClick={onCreateProject}
          type="button"
          title="新建工作区"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-6">
        {projects.map((project) => {
          return (
            <section className="space-y-2" key={project.id}>
              <div className="group flex items-center justify-between px-2 py-1 text-sm font-semibold text-foreground relative">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Folder size={16} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{project.name}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex p-0 items-center gap-0.5 transition-opacity">
                  <div className="relative">
                    <button
                      className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors flex items-center justify-center h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionPrompt(sessionPrompt === project.id ? null : project.id);
                      }}
                      title="新建会话"
                    >
                      <Plus size={14} />
                    </button>
                    {sessionPrompt === project.id && (
                      <div className="absolute right-0 top-full mt-1 bg-popover border border-border text-popover-foreground shadow-md rounded-md py-1 min-w-36 z-50">
                        <div
                          className="px-3 py-2 text-xs hover:bg-muted cursor-pointer font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateSessionWithOptions(project.id, { provider: "codex", profileId: null });
                            setSessionPrompt(null);
                          }}
                        >
                          Codex
                        </div>
                        <div
                          className="px-3 py-2 text-xs hover:bg-muted cursor-pointer font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateSessionWithOptions(project.id, { provider: "claude", profileId: null });
                            setSessionPrompt(null);
                          }}
                        >
                          Claude Code
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors flex items-center justify-center h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectDeleteTarget(project);
                    }}
                    title="移除工作区"
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
                  </button>
                </div>
              </div>

              <div className="space-y-0.5">
                {project.sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isOpen = openSessionIds.has(session.id);
                  const openCount = openSessionCounts[session.id] ?? 0;
                  return (
                    <button
                      className={cn(
                        "group/session flex items-center justify-between w-full px-2 py-1.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-primary/30",
                        isActive
                          ? "bg-muted/80 text-foreground font-medium"
                          : isOpen
                            ? "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                      key={session.id}
                      onClick={() => onOpenSession(project.id, session.id, "replace")}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setSessionMenu({
                          projectId: project.id,
                          sessionId: session.id,
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                      title={session.title}
                      type="button"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                        {session.provider === "claude" ? (
                          <Bot size={13} className="shrink-0 opacity-70" />
                        ) : (
                          <Terminal size={13} className="shrink-0 opacity-70" />
                        )}

                        <span className="truncate text-[13px] leading-tight flex-1 text-left">
                          {session.title}
                        </span>

                        {session.status === "running" && (
                          <Loader2 size={12} className="shrink-0 animate-spin text-primary" />
                        )}

                        {session.unreadCount > 0 && (
                          <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[9px] font-bold text-primary">
                            {session.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[11px] opacity-80 whitespace-nowrap">
                        {isOpen && (
                          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400" title={`已打开窗格数: ${openCount}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {openCount > 1 ? openCount : ""}
                          </span>
                        )}
                        <span className="tabular-nums opacity-60 group-hover/session:opacity-100 transition-opacity">
                          {formatTimeAgo(session.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="p-3 mt-auto">
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground text-sm transition-colors"
          onClick={onOpenGlobalSettings}
          type="button"
        >
          <Settings size={18} />
          全局设置
        </button>
      </div>

      {sessionMenu && (
        <div
          className="fixed z-[100] min-w-40 rounded-xl border border-border bg-popover p-1 shadow-xl"
          style={{ left: sessionMenu.x, top: sessionMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            onClick={() => {
              onOpenSession(sessionMenu.projectId, sessionMenu.sessionId, "split");
              setSessionMenu(null);
            }}
            type="button"
          >
            分屏打开
          </button>
          <button
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!projects
              .find((candidate) => candidate.id === sessionMenu.projectId)
              ?.sessions.find((candidate) => candidate.id === sessionMenu.sessionId)
              ?.providerSessionId}
            onClick={async () => {
              const project = projects.find((candidate) => candidate.id === sessionMenu.projectId);
              const session = project?.sessions.find((candidate) => candidate.id === sessionMenu.sessionId);
              if (!session?.providerSessionId) {
                return;
              }
              await navigator.clipboard.writeText(session.providerSessionId);
              setSessionMenu(null);
            }}
            type="button"
          >
            复制原始会话 ID
          </button>
          <button
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            onClick={() => {
              const project = projects.find((candidate) => candidate.id === sessionMenu.projectId);
              const session = project?.sessions.find((candidate) => candidate.id === sessionMenu.sessionId);
              if (session) {
                setSessionDeleteTarget({
                  projectId: sessionMenu.projectId,
                  sessionId: sessionMenu.sessionId,
                  title: session.title,
                });
              }
              setSessionMenu(null);
            }}
            type="button"
          >
            删除会话
          </button>
        </div>
      )}

      {sessionDeleteTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/20 px-4"
          onClick={() => setSessionDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">删除会话</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                确定删除会话“{sessionDeleteTarget.title}”吗？此操作不会恢复。
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setSessionDeleteTarget(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  onDeleteSession(sessionDeleteTarget.projectId, sessionDeleteTarget.sessionId);
                  setSessionDeleteTarget(null);
                }}
                type="button"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {projectDeleteTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/20 px-4"
          onClick={() => setProjectDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">删除工作区</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                确定删除工作区“{projectDeleteTarget.name}”吗？此操作不会恢复。
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setProjectDeleteTarget(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  onDeleteProject(projectDeleteTarget.id);
                  setProjectDeleteTarget(null);
                }}
                type="button"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </aside >
  );
}
