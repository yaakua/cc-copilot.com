import { useEffect, useMemo, useState } from "react";
import {
  assignPaneProfile,
  closePane,
  createProject,
  createSession,
  deleteProviderProfile,
  focusPane,
  getDashboardState,
  getRemoteStatus,
  launchProviderLogin,
  openPane,
  onComposerStream,
  saveProviderProfile,
  cancelPaneRun,
  startComposerStream,
  testProviderProfile,
  toggleRemoteTunnel,
} from "../lib/backend";
import { buildThreadStats, deriveLayout, normalizeDashboardState, normalizeRemote } from "../lib/normalize";
import { createMockDashboardState } from "../features/workspace/mock";
import type {
  ComposerTargetMode,
  DashboardState,
  Pane,
  ProviderProfile,
  Project,
} from "../types/domain";

export function useDashboard() {
  const [dashboard, setDashboard] = useState<DashboardState>(() => createMockDashboardState());
  const [composerValue, setComposerValue] = useState("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const [dashboardState, remoteState] = await Promise.all([
          getDashboardState(),
          getRemoteStatus(),
        ]);

        if (!mounted) {
          return;
        }

        setDashboard(normalizeDashboardState(dashboardState, remoteState));
        setRequestError(null);
      } catch (error) {
        if (mounted) {
          setRequestError(
            error instanceof Error
              ? error.message
              : "Backend unavailable, using local workspace preview.",
          );
        }
      } finally {
        if (mounted) {
          setIsHydrating(false);
        }
      }
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const unlistenPromise = onComposerStream((event) => {
      if (disposed) {
        return;
      }

      if (event.stage === "started") {
        setRequestError(null);
        return;
      }

      if (event.stage === "delta") {
        const chunk = event.chunk ?? "";
        setDashboard((current) => ({
          ...current,
          workspace: {
            ...current.workspace,
            panes: current.workspace.panes.map((pane) => {
              if (pane.id !== event.paneId) {
                return pane;
              }

              const messageKind =
                event.role === "system" ? "error" : "message";
              const existingMessage = pane.messages.find(
                (message) => message.id === event.messageId,
              );

              if (existingMessage) {
                return {
                  ...pane,
                  status: event.role === "system" ? "error" : "running",
                  messages: pane.messages.map((message) =>
                    message.id === event.messageId
                      ? { ...message, body: `${message.body}${chunk}` }
                      : message,
                  ),
                };
              }

              return {
                ...pane,
                status: event.role === "system" ? "error" : "running",
                messages: [
                  ...pane.messages,
                  {
                    id: event.messageId,
                    kind: messageKind,
                    role: event.role,
                    body: chunk,
                    createdAt: new Date().toISOString(),
                  },
                ],
              };
            }),
          },
        }));
        return;
      }

      if (event.stage === "failed") {
        setRequestError(event.chunk ?? "Streaming request failed.");
      }

      void refreshFromBackend();
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const currentProject = useMemo(() => {
    if (!dashboard.workspace.projectId) {
      return dashboard.projects[0] ?? null;
    }
    return dashboard.projects.find((project) => project.id === dashboard.workspace.projectId) ?? null;
  }, [dashboard.projects, dashboard.workspace.projectId]);

  const activePane = useMemo(() => {
    return (
      dashboard.workspace.panes.find((pane) => pane.id === dashboard.workspace.activePaneId) ??
      dashboard.workspace.panes[0] ??
      null
    );
  }, [dashboard.workspace.activePaneId, dashboard.workspace.panes]);

  const activeSession = useMemo(() => {
    if (!activePane || !currentProject) {
      return null;
    }
    return currentProject.sessions.find((session) => session.id === activePane.sessionId) ?? null;
  }, [activePane, currentProject]);

  const canAddPane = dashboard.workspace.panes.length < 4;
  const canClosePane = dashboard.workspace.panes.length > 1;
  const threadStats = useMemo(
    () => buildThreadStats(activePane?.messages ?? []),
    [activePane?.messages],
  );
  const defaultProvider = useMemo(
    () => selectDefaultProvider(dashboard.providers),
    [dashboard.providers],
  );
  const profiles = dashboard.providerProfiles;
  const paneProfiles = useMemo(
    () =>
      Object.fromEntries(
        dashboard.workspace.panes.map((pane) => [
          pane.id,
          profiles.find((profile) => profile.id === pane.profileId) ?? null,
        ]),
      ),
    [dashboard.workspace.panes, profiles],
  );

  async function refreshFromBackend() {
    try {
      const [next, remote] = await Promise.all([getDashboardState(), getRemoteStatus()]);
      setDashboard(normalizeDashboardState(next, remote));
    } catch {
      // Keep optimistic local state.
    }
  }

  async function handleCreateProject() {
    const nextIndex = dashboard.projects.length + 1;
    const optimisticProject: Project = {
      id: `project-${nextIndex}`,
      name: `Workspace ${nextIndex}`,
      path: `/Users/yangkui/workspace/project-${nextIndex}`,
      sessions: [],
      lastActiveAt: new Date().toISOString(),
    };

    setDashboard((current) => ({
      ...current,
      projects: [optimisticProject, ...current.projects],
      workspace: {
        ...current.workspace,
        projectId: optimisticProject.id,
      },
    }));

    try {
      await createProject({
        name: optimisticProject.name,
        path: optimisticProject.path,
      });
      await refreshFromBackend();
    } catch {
      // Keep optimistic state in local preview mode.
    }
  }

  async function handleCreateSession(projectId: string) {
    const provider = defaultProvider;
    const defaultProfileId = defaultProfileForProvider(profiles, provider)?.id ?? null;
    return handleCreateSessionWithOptions(projectId, {
      provider,
      profileId: defaultProfileId,
    });
  }

  async function handleCreateSessionWithOptions(
    projectId: string,
    options: { provider: "claude" | "codex"; profileId: string | null },
  ) {
    const now = new Date().toISOString();
    const nextIndex =
      (dashboard.projects.find((project) => project.id === projectId)?.sessions.length ?? 0) + 1;
    const sessionId = `session-${Math.random().toString(36).slice(2, 8)}`;

    setDashboard((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              lastActiveAt: now,
              sessions: [
                {
                  id: sessionId,
                  title: `New session ${project.sessions.length + 1}`,
                  provider: options.provider,
                  profileId: options.profileId,
                  lastActiveAt: now,
                  status: "idle",
                  imported: false,
                  unreadCount: 0,
                },
                ...project.sessions,
              ],
            }
          : project,
      ),
      workspace: {
        ...current.workspace,
        projectId,
      },
    }));

    try {
      await createSession({
        projectId,
        title: `New session ${nextIndex}`,
        provider: options.provider === "codex" ? "openAi" : "anthropic",
        profileId: options.profileId,
      });
      await refreshFromBackend();
    } catch {
      // Keep optimistic preview.
    }
  }

  async function handleOpenSession(projectId: string, sessionId: string) {
    const sessionTitle =
      dashboard.projects
        .find((project) => project.id === projectId)
        ?.sessions.find((session) => session.id === sessionId)?.title ?? "Workspace session";

    setDashboard((current) => {
      const project = current.projects.find((item) => item.id === projectId);
      const session = project?.sessions.find((item) => item.id === sessionId);

      if (!session) {
        return current;
      }

      const existingPane = current.workspace.panes.find((pane) => pane.sessionId === sessionId);
      if (existingPane) {
        return {
          ...current,
          workspace: {
            ...current.workspace,
            activePaneId: existingPane.id,
            selectedPaneIds: [existingPane.id],
          },
        };
      }

      if (current.workspace.panes.length >= 4) {
        return current;
      }

      const nextPane: Pane = {
        id: `pane-${Math.random().toString(36).slice(2, 8)}`,
        sessionId,
        title: session.title,
        provider: session.provider,
        profileId: session.profileId,
        status: session.status,
        selected: false,
        messages: [
          {
            id: `message-${Math.random().toString(36).slice(2, 8)}`,
            kind: "session_meta",
            role: "system",
            body: `Workspace attached to ${session.title}.`,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const nextPanes = [...current.workspace.panes, nextPane];
      return {
        ...current,
        workspace: {
          ...current.workspace,
          projectId,
          panes: nextPanes,
          activePaneId: nextPane.id,
          selectedPaneIds: [nextPane.id],
          layout: deriveLayout(nextPanes.length),
        },
      };
    });

    try {
      await openPane({
        sessionId,
        title: sessionTitle,
        kind: "chat",
        profileId:
          dashboard.projects
            .find((project) => project.id === projectId)
            ?.sessions.find((session) => session.id === sessionId)?.profileId ?? null,
        focus: true,
      });
      await refreshFromBackend();
    } catch {
      // Local preview mode fallback.
    }
  }

  async function handleAddPane() {
    const project = currentProject;
    if (!project || dashboard.workspace.panes.length >= 4) {
      return;
    }

    const sourceSession =
      project.sessions.find((session) => session.id === activePane?.sessionId) ?? project.sessions[0];
    if (!sourceSession) {
      return;
    }

    return handleAddPaneWithOptions({
      sessionId: sourceSession.id,
      profileId: activePane?.profileId ?? sourceSession.profileId,
    });
  }

  async function handleAddPaneWithOptions(options: {
    sessionId: string;
    profileId: string | null;
  }) {
    const project = currentProject;
    if (!project || dashboard.workspace.panes.length >= 4) {
      return;
    }

    const sourceSession = project.sessions.find((session) => session.id === options.sessionId);
    if (!sourceSession) {
      return;
    }

    const duplicateCount =
      dashboard.workspace.panes.filter((pane) => pane.sessionId === sourceSession.id).length + 1;
    const nextTitle =
      duplicateCount > 1 ? `${sourceSession.title} / Pane ${duplicateCount}` : sourceSession.title;

    setDashboard((current) => {
      const nextPane: Pane = {
        id: `pane-${Math.random().toString(36).slice(2, 8)}`,
        sessionId: sourceSession.id,
        title: nextTitle,
        provider: sourceSession.provider,
        profileId: options.profileId,
        status: sourceSession.status,
        selected: false,
        messages:
          dashboard.workspace.panes.find((pane) => pane.sessionId === sourceSession.id)?.messages ?? [],
      };

      const nextPanes = [...current.workspace.panes, nextPane];
      return {
        ...current,
        workspace: {
          ...current.workspace,
          panes: nextPanes,
          activePaneId: nextPane.id,
          selectedPaneIds: [nextPane.id],
          layout: deriveLayout(nextPanes.length),
        },
      };
    });

    try {
      await openPane({
        sessionId: sourceSession.id,
        title: nextTitle,
        kind: "chat",
        profileId: options.profileId,
        focus: true,
      });
      await refreshFromBackend();
    } catch {
      // Keep optimistic pane.
    }
  }

  async function handleClosePane(paneId: string) {
    if (dashboard.workspace.panes.length <= 1) {
      return;
    }

    setDashboard((current) => {
      const nextPanes = current.workspace.panes.filter((pane) => pane.id !== paneId);
      return {
        ...current,
        workspace: {
          ...current.workspace,
          panes: nextPanes,
          activePaneId:
            current.workspace.activePaneId === paneId
              ? nextPanes[0]?.id ?? null
              : current.workspace.activePaneId,
          selectedPaneIds: current.workspace.selectedPaneIds.filter((id) => id !== paneId),
          layout: deriveLayout(nextPanes.length),
        },
      };
    });

    try {
      await closePane(paneId);
      await refreshFromBackend();
    } catch {
      // Keep optimistic state.
    }
  }

  async function handleFocusPane(paneId: string) {
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        activePaneId: paneId,
      },
    }));

    try {
      await focusPane(paneId);
      await refreshFromBackend();
    } catch {
      // Ignore in preview mode.
    }
  }

  function handleTogglePaneSelection(paneId: string) {
    setDashboard((current) => {
      const selected = new Set(current.workspace.selectedPaneIds);
      if (selected.has(paneId)) {
        selected.delete(paneId);
      } else {
        selected.add(paneId);
      }
      return {
        ...current,
        workspace: {
          ...current.workspace,
          selectedPaneIds: [...selected],
        },
      };
    });
  }

  async function handleAssignProfileToPane(paneId: string, profileId: string) {
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          pane.id === paneId ? { ...pane, profileId: profileId || null } : pane,
        ),
      },
    }));

    try {
      await assignPaneProfile({ paneId, profileId: profileId || null });
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Profile binding failed.");
    }
  }

  async function handleSaveProfile(profile: {
    id?: string | null;
    provider: "claude" | "codex";
    label: string;
    authKind: "apiKey" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) {
    try {
      await saveProviderProfile({
        id: profile.id ?? null,
        provider: profile.provider === "codex" ? "openAi" : "anthropic",
        label: profile.label,
        authKind: profile.authKind,
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: profile.model ?? null,
      });
      setRequestError(null);
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Profile save failed.");
    }
  }

  async function handleDeleteProfile(profileId: string) {
    try {
      await deleteProviderProfile(profileId);
      setRequestError(null);
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Profile delete failed.");
    }
  }

  async function handleTestProfile(profile: {
    id?: string | null;
    provider: "claude" | "codex";
    label?: string | null;
    authKind: "apiKey" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) {
    return testProviderProfile({
      profileId: profile.id ?? null,
      provider: profile.provider === "codex" ? "openAi" : "anthropic",
      label: profile.label ?? null,
      authKind: profile.authKind,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model ?? null,
    });
  }

  async function handleLaunchProviderLogin(provider: "claude" | "codex") {
    try {
      const result = await launchProviderLogin({
        provider: provider === "codex" ? "openAi" : "anthropic",
      });
      setRequestError(result.message);
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to open provider login.");
    }
  }

  async function handleToggleRemote(enabled: boolean) {
    setDashboard((current) => ({
      ...current,
      remote: {
        ...current.remote,
        status: enabled ? "connecting" : "idle",
      },
    }));

    try {
      const remote = await toggleRemoteTunnel(enabled);
      setDashboard((current) => ({ ...current, remote: normalizeRemote(remote) }));
    } catch {
      setDashboard((current) => ({
        ...current,
        remote: {
          ...current.remote,
          status: enabled ? "online" : "idle",
        },
      }));
    }
  }

  async function handleSendMessage(targetMode: ComposerTargetMode) {
    const content = composerValue.trim();
    if (!content) {
      return;
    }

    const targetPaneIds = resolveTargetPaneIds(
      dashboard.workspace.panes,
      dashboard.workspace.activePaneId,
      dashboard.workspace.selectedPaneIds,
      targetMode,
    );
    if (targetPaneIds.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          targetPaneIds.includes(pane.id)
            ? {
                ...pane,
                status: "running",
                messages: [
                  ...pane.messages,
                  {
                    id: `message-${Math.random().toString(36).slice(2, 8)}`,
                    kind: "message",
                    role: "user",
                    body: content,
                    createdAt,
                  },
                ],
              }
            : pane,
        ),
      },
    }));

    setComposerValue("");

    try {
      await Promise.all(
        targetPaneIds.map((paneId) => startComposerStream({ paneId, content })),
      );
      setRequestError(null);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Message dispatch failed.",
      );
    }
  }

  async function handleCancelPaneRun(paneId: string) {
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          pane.id === paneId ? { ...pane, status: "idle" } : pane,
        ),
      },
    }));

    try {
      await cancelPaneRun({ paneId });
      setRequestError(null);
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Failed to cancel pane run.");
      await refreshFromBackend();
    }
  }

  return {
    dashboard,
    composerValue,
    setComposerValue,
    isHydrating,
    requestError,
    currentProject,
    activePane,
    activeSession,
    paneProfiles,
    profiles,
    canAddPane,
    canClosePane,
    threadStats,
    handleCreateProject,
    handleCreateSession,
    handleCreateSessionWithOptions,
    handleOpenSession,
    handleAddPane,
    handleAddPaneWithOptions,
    handleClosePane,
    handleFocusPane,
    handleTogglePaneSelection,
    assignProfileToPane: handleAssignProfileToPane,
    saveProfile: handleSaveProfile,
    deleteProfile: handleDeleteProfile,
    testProfile: handleTestProfile,
    launchProviderLogin: handleLaunchProviderLogin,
    handleToggleRemote,
    handleSendMessage,
    cancelPaneRun: handleCancelPaneRun,
  };
}

function selectDefaultProvider(
  providers: DashboardState["providers"],
): "claude" | "codex" {
  const codex = providers.find((provider) => provider.id === "codex");
  if (codex?.availability === "ready") {
    return "codex";
  }

  const claude = providers.find((provider) => provider.id === "claude");
  if (claude?.availability === "ready" || claude?.availability === "warning") {
    return "claude";
  }

  return "codex";
}

function resolveTargetPaneIds(
  panes: Pane[],
  activePaneId: string | null,
  selectedPaneIds: string[],
  mode: ComposerTargetMode,
) {
  if (mode === "selected") {
    return selectedPaneIds.length > 0 ? selectedPaneIds : activePaneId ? [activePaneId] : [];
  }
  if (mode === "all") {
    return panes.map((pane) => pane.id);
  }
  return activePaneId ? [activePaneId] : [];
}

function defaultProfileForProvider(
  profiles: ProviderProfile[],
  provider: "claude" | "codex",
) {
  return profiles.find((profile) => profile.provider === provider) ?? null;
}
