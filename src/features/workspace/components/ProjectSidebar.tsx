import { useEffect, useState } from "react";
import type { Project, ProviderProfile, ProviderKind } from "../../../types/domain";

interface ProjectSidebarProps {
  projects: Project[];
  profiles: ProviderProfile[];
  currentProjectId: string | null;
  onCreateProject: () => void;
  onCreateSession: (projectId: string) => void;
  onCreateSessionWithOptions: (
    projectId: string,
    options: { provider: ProviderKind; profileId: string | null },
  ) => void;
  onOpenSession: (projectId: string, sessionId: string) => void;
}

export function ProjectSidebar({
  projects,
  profiles,
  currentProjectId,
  onCreateProject,
  onCreateSession,
  onCreateSessionWithOptions,
  onOpenSession,
}: ProjectSidebarProps) {
  const [drafts, setDrafts] = useState<
    Record<string, { provider: ProviderKind; profileId: string | null }>
  >({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const project of projects) {
        if (!next[project.id]) {
          const provider = project.sessions[0]?.provider ?? "codex";
          const profileId =
            profiles.find((profile) => profile.provider === provider)?.id ?? null;
          next[project.id] = { provider, profileId };
        }
      }
      return next;
    });
  }, [profiles, projects]);

  return (
    <aside className="app-sidebar">
      <div className="window-actions">
        <span className="traffic-dot traffic-red" />
        <span className="traffic-dot traffic-yellow" />
        <span className="traffic-dot traffic-green" />
      </div>

      <nav className="sidebar-shortcuts" aria-label="Main navigation">
        <button className="sidebar-shortcut sidebar-shortcut-active" type="button">
          <span className="sidebar-shortcut-icon">◌</span>
          新线程
        </button>
        <button className="sidebar-shortcut" type="button">
          <span className="sidebar-shortcut-icon">◔</span>
          自动化
        </button>
        <button className="sidebar-shortcut" type="button">
          <span className="sidebar-shortcut-icon">◫</span>
          技能
        </button>
      </nav>

      <div className="sidebar-section-header">
        <span>线程</span>
        <button className="sidebar-inline-button" onClick={onCreateProject} type="button">
          +
        </button>
      </div>

      <div className="thread-groups">
        {projects.map((project) => {
          const isCurrent = project.id === currentProjectId;

          return (
            <section className="thread-group" key={project.id}>
              <div className="thread-group-title">
                <span className="thread-group-folder">▣</span>
                <span>{project.name}</span>
              </div>

              <div className="thread-list">
                {project.sessions.map((session, index) => (
                  <button
                    className={
                      isCurrent && index === 0 ? "thread-row thread-row-active" : "thread-row"
                    }
                    key={session.id}
                    onClick={() => onOpenSession(project.id, session.id)}
                    type="button"
                  >
                    <div className="thread-row-main">
                      <span className="thread-row-title">{session.title}</span>
                      <span className="thread-row-score">
                        {session.provider === "claude" ? "+300" : "+62"}
                      </span>
                    </div>
                    <div className="thread-row-meta">
                      <span>{session.provider}</span>
                      <span>{session.status}</span>
                      {session.unreadCount > 0 ? <span>{session.unreadCount} 分</span> : <span>43 分</span>}
                    </div>
                  </button>
                ))}
              </div>

              <button
                className="thread-create-button"
                onClick={() => {
                  const draft = drafts[project.id];
                  if (!draft) {
                    onCreateSession(project.id);
                    return;
                  }
                  onCreateSessionWithOptions(project.id, draft);
                }}
                type="button"
              >
                为 {project.name} 新建会话
              </button>
              <div className="thread-create-controls">
                <select
                  onChange={(event) => {
                    const provider = event.currentTarget.value as ProviderKind;
                    setDrafts((current) => ({
                      ...current,
                      [project.id]: {
                        provider,
                        profileId:
                          profiles.find((profile) => profile.provider === provider)?.id ?? null,
                      },
                    }));
                  }}
                  value={drafts[project.id]?.provider ?? "codex"}
                >
                  <option value="codex">Codex</option>
                  <option value="claude">Claude</option>
                </select>
                <select
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [project.id]: {
                        provider: current[project.id]?.provider ?? "codex",
                        profileId: event.currentTarget.value || null,
                      },
                    }))
                  }
                  value={drafts[project.id]?.profileId ?? ""}
                >
                  <option value="">系统登录 / 默认</option>
                  {profiles
                    .filter(
                      (profile) =>
                        profile.provider === (drafts[project.id]?.provider ?? "codex"),
                    )
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                </select>
              </div>
            </section>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-shortcut" type="button">
          <span className="sidebar-shortcut-icon">⚙</span>
          设置
        </button>
      </div>
    </aside>
  );
}
