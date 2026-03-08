import { useEffect, useMemo, useState } from "react";
import type { Pane, Project, ProviderProfile } from "../../../types/domain";
import { providerAccent } from "../../provider/useProviderProfiles";

interface PaneGridProps {
  panes: Pane[];
  currentProject: Project | null;
  paneProfiles: Record<string, ProviderProfile | null>;
  profiles: ProviderProfile[];
  activePaneId: string | null;
  selectedPaneIds: string[];
  canAddPane: boolean;
  canClosePane: boolean;
  onAddPane: () => void;
  onAddPaneWithOptions: (options: { sessionId: string; profileId: string | null }) => void;
  onCancelRun: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onFocusPane: (paneId: string) => void;
  onTogglePaneSelection: (paneId: string) => void;
  onAssignProfile: (paneId: string, profileId: string) => void;
}

export function PaneGrid({
  panes,
  currentProject,
  paneProfiles,
  profiles,
  activePaneId,
  selectedPaneIds,
  canAddPane,
  canClosePane,
  onAddPane,
  onAddPaneWithOptions,
  onCancelRun,
  onClosePane,
  onFocusPane,
  onTogglePaneSelection,
  onAssignProfile,
}: PaneGridProps) {
  const [newPaneSessionId, setNewPaneSessionId] = useState<string>("");
  const [newPaneProfileId, setNewPaneProfileId] = useState<string>("");
  const gridClassName =
    panes.length >= 4
      ? "pane-workspace-grid pane-workspace-grid-quad"
      : panes.length === 3
        ? "pane-workspace-grid pane-workspace-grid-triple"
        : panes.length === 2
          ? "pane-workspace-grid pane-workspace-grid-dual"
          : "pane-workspace-grid pane-workspace-grid-single";
  const selectedSession = useMemo(
    () =>
      currentProject?.sessions.find((session) => session.id === newPaneSessionId) ??
      currentProject?.sessions.find((session) => session.id === panes[0]?.sessionId) ??
      null,
    [currentProject, newPaneSessionId, panes],
  );

  useEffect(() => {
    if (!currentProject?.sessions.length) {
      setNewPaneSessionId("");
      setNewPaneProfileId("");
      return;
    }

    setNewPaneSessionId((current) => {
      if (currentProject.sessions.some((session) => session.id === current)) {
        return current;
      }
      return currentProject.sessions.find((session) => session.id === panes[0]?.sessionId)?.id
        ?? currentProject.sessions[0].id;
    });
  }, [currentProject, panes]);

  useEffect(() => {
    if (!selectedSession) {
      setNewPaneProfileId("");
      return;
    }

    setNewPaneProfileId((current) => {
      const eligible = profiles.filter((profile) => profile.provider === selectedSession.provider);
      if (current && eligible.some((profile) => profile.id === current)) {
        return current;
      }
      return selectedSession.profileId ?? eligible[0]?.id ?? "";
    });
  }, [profiles, selectedSession]);

  return (
    <section className="pane-dock">
      <div className="pane-dock-header">
        <div className="pane-dock-meta">
          <span>工作窗格</span>
          <strong>{panes.length}/4</strong>
        </div>
        <div className="pane-dock-controls">
          <select
            disabled={!currentProject?.sessions.length}
            onChange={(event) => setNewPaneSessionId(event.currentTarget.value)}
            value={selectedSession?.id ?? ""}
          >
            {currentProject?.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title} · {session.provider}
              </option>
            ))}
          </select>
          <select
            disabled={!selectedSession}
            onChange={(event) => setNewPaneProfileId(event.currentTarget.value)}
            value={newPaneProfileId}
          >
            <option value="">系统登录 / 默认</option>
            {profiles
              .filter((profile) => profile.provider === selectedSession?.provider)
              .map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
          </select>
          <button
            className={canAddPane ? "toolbar-button toolbar-button-primary" : "toolbar-button"}
            disabled={!canAddPane}
            onClick={() => {
              if (selectedSession) {
                onAddPaneWithOptions({
                  sessionId: selectedSession.id,
                  profileId: newPaneProfileId || null,
                });
                return;
              }
              onAddPane();
            }}
            type="button"
          >
            新建窗口
          </button>
        </div>
      </div>

      <div className={gridClassName}>
        {panes.map((pane, index) => {
          const isActive = pane.id === activePaneId;
          const isSelected = selectedPaneIds.includes(pane.id);
          const previewMessages = pane.messages.slice(-3);
          const providerLabel = pane.provider === "claude" ? "Claude" : "Codex";
          const paneProfile = paneProfiles[pane.id];
          const eligibleProfiles = profiles.filter((profile) => profile.provider === pane.provider);

          return (
            <div
              className={isActive ? "pane-window pane-window-active" : "pane-window"}
              key={pane.id}
              onClick={() => onFocusPane(pane.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFocusPane(pane.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="pane-window-toolbar">
                <div className="pane-window-meta">
                  <div className="pane-window-index">{index + 1}</div>
                  <div className="pane-window-copy">
                    <strong>{pane.title}</strong>
                    <span>{providerLabel} session</span>
                    {paneProfile ? (
                      <span className="pane-window-profile-badge">
                        <span
                          className="pane-window-profile-dot"
                          style={{ backgroundColor: providerAccent(paneProfile) }}
                        />
                        {paneProfile.label}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="pane-window-actions">
                  <span className={`pane-window-status pane-window-status-${pane.status}`}>
                    {pane.status}
                  </span>
                  {pane.status === "running" ? (
                    <button
                      className="pane-window-cancel"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCancelRun(pane.id);
                      }}
                      type="button"
                    >
                      取消
                    </button>
                  ) : null}
                  <label className="pane-window-select">
                    <input
                      checked={isSelected}
                      onChange={() => onTogglePaneSelection(pane.id)}
                      type="checkbox"
                    />
                  </label>
                  <button
                    className="pane-window-close"
                    disabled={!canClosePane}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClosePane(pane.id);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="pane-window-screen">
                <div className="pane-window-screen-title">
                  <span>{providerLabel}</span>
                  <div className="pane-window-profile-select">
                    <span>{pane.title}</span>
                    <select
                      onChange={(event) => onAssignProfile(pane.id, event.currentTarget.value)}
                      onClick={(event) => event.stopPropagation()}
                      value={paneProfile?.id ?? ""}
                    >
                      <option value="">系统登录 / 默认</option>
                      {eligibleProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {previewMessages.map((message) => (
                  <div
                    className={
                      message.role === "assistant"
                        ? "pane-window-line pane-window-line-assistant"
                        : message.role === "system"
                          ? "pane-window-line pane-window-line-system"
                          : "pane-window-line"
                    }
                    key={message.id}
                  >
                    <span>{message.role}</span>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
