import { useEffect, useState } from "react";
import { Folder, Plus, Settings } from "lucide-react";
import type { Project, ProviderKind } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface ProjectSidebarProps {
  projects: Project[];
  currentProjectId: string | null;
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
}

export function ProjectSidebar({
  projects,
  currentProjectId,
  activeSessionId,
  openSessionIds,
  openSessionCounts,
  onCreateProject,
  onCreateSessionWithOptions,
  onOpenSession,
  onDeleteProject,
  onDeleteSession,
}: ProjectSidebarProps) {
  // Track which project is showing the new session dropdown
  const [sessionPrompt, setSessionPrompt] = useState<string | null>(null);
  const [sessionMenu, setSessionMenu] = useState<{
    projectId: string;
    sessionId: string;
    x: number;
    y: number;
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
          const isCurrent = project.id === currentProjectId;

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

              <div className="space-y-1">
                {project.sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isOpen = openSessionIds.has(session.id);
                  const openCount = openSessionCounts[session.id] ?? 0;
                  return (
                    <button
                      className={cn(
                        "group/session w-full text-left p-3 rounded-xl border transition-all space-y-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20",
                        isActive
                          ? "bg-background shadow-sm border-primary/30"
                          : isOpen
                            ? "bg-background/70 border-border hover:border-border/80"
                            : "border-transparent hover:bg-muted/50"
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
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("text-sm font-medium truncate", isActive ? "text-foreground" : "text-muted-foreground flex-1")}>
                          {session.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isOpen && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {openCount > 1 ? `已打开 ${openCount}` : "已打开"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="capitalize">{session.provider === "claude" ? "Claude" : "Codex"}</span>
                          <span>•</span>
                          <span className="capitalize">{session.status}</span>
                        </div>
                        {session.unreadCount > 0 && (
                          <span className="font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {session.unreadCount} 条新消息
                          </span>
                        )}
                      </div>
                      {isCurrent && !isActive && isOpen && (
                        <div className="text-[11px] text-muted-foreground">单击切到当前窗格，右键可分屏打开或删除</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="p-3 mt-auto">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground text-sm transition-colors" type="button">
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
              if (session && window.confirm(`确定删除会话“${session.title}”吗？`)) {
                onDeleteSession(sessionMenu.projectId, sessionMenu.sessionId);
              }
              setSessionMenu(null);
            }}
            type="button"
          >
            删除会话
          </button>
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
