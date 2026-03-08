import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  assignPaneProfile,
  closePane,
  createProject,
  createSession,
  deleteProject,
  deleteProviderProfile,
  deleteSession,
  focusPane,
  getDashboardState,
  getRemoteStatus,
  launchProviderLogin,
  openPane,
  replacePaneSession,
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
  SessionSummary,
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
  const openSessionIds = useMemo(
    () => new Set(dashboard.workspace.panes.map((pane) => pane.sessionId)),
    [dashboard.workspace.panes],
  );
  const openSessionCounts = useMemo(
    () =>
      dashboard.workspace.panes.reduce<Record<string, number>>((counts, pane) => {
        counts[pane.sessionId] = (counts[pane.sessionId] ?? 0) + 1;
        return counts;
      }, {}),
    [dashboard.workspace.panes],
  );

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
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "选择工作区文件夹",
    });

    if (!selectedPath || Array.isArray(selectedPath)) {
      return;
    }

    const name = basename(selectedPath);
    const now = new Date().toISOString();
    const optimisticProject: Project = {
      id: `project-${Math.random().toString(36).slice(2, 8)}`,
      name,
      path: selectedPath,
      sessions: [],
      lastActiveAt: now,
    };

    setDashboard((current) => ({
      ...current,
      projects: [...current.projects, optimisticProject],
      workspace: {
        ...current.workspace,
        projectId: optimisticProject.id,
      },
    }));

    try {
      await createProject({
        name,
        path: selectedPath,
      });
      setRequestError(null);
      await refreshFromBackend();
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Failed to add workspace.",
      );
      await refreshFromBackend();
    }
  }

  async function handleDeleteProject(projectId: string) {
    // Optimistic UI update
    setDashboard((current) => {
      const projects = current.projects.filter((p) => p.id !== projectId);
      const workspace = { ...current.workspace };
      if (workspace.projectId === projectId) {
        workspace.projectId = projects.length > 0 ? projects[0].id : null;
      }
      return { ...current, projects, workspace };
    });

    try {
      await deleteProject({ projectId });
      await refreshFromBackend();
    } catch {
      // Revert optimism if failed or local preview
      await refreshFromBackend();
    }
  }

  async function handleDeleteSession(projectId: string, sessionId: string) {
    setDashboard((current) => {
      const projects = current.projects.map((project) =>
        project.id === projectId
          ? {
            ...project,
            sessions: project.sessions.filter((session) => session.id !== sessionId),
          }
          : project,
      );
      const nextPanes = current.workspace.panes.filter((pane) => pane.sessionId !== sessionId);
      const nextActivePaneId =
        current.workspace.activePaneId &&
        nextPanes.some((pane) => pane.id === current.workspace.activePaneId)
          ? current.workspace.activePaneId
          : nextPanes[0]?.id ?? null;

      return {
        ...current,
        projects,
        workspace: {
          ...current.workspace,
          panes: nextPanes,
          activePaneId: nextActivePaneId,
          selectedPaneIds: current.workspace.selectedPaneIds.filter((paneId) =>
            nextPanes.some((pane) => pane.id === paneId),
          ),
          layout: deriveLayout(nextPanes.length),
        },
      };
    });

    try {
      await deleteSession({ projectId, sessionId });
      await refreshFromBackend();
    } catch {
      await refreshFromBackend();
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

    const optimisticSession: SessionSummary = {
      id: sessionId,
      title: `New session ${nextIndex}`,
      provider: options.provider,
      profileId: options.profileId,
      providerSessionId: null,
      lastActiveAt: now,
      status: "idle",
      imported: false,
      unreadCount: 0,
    };

    setDashboard((current) => {
      const activePaneId = current.workspace.activePaneId;
      const hasActivePane = Boolean(activePaneId);
      const projects = current.projects.map((project) =>
        project.id === projectId
          ? {
            ...project,
            lastActiveAt: now,
            sessions: [optimisticSession, ...project.sessions],
          }
          : project,
      );

      if (!hasActivePane) {
        const nextPane = createPaneFromSession(optimisticSession);
        return {
          ...current,
          projects,
          workspace: {
            ...current.workspace,
            projectId,
            panes: [nextPane],
            activePaneId: nextPane.id,
            selectedPaneIds: [nextPane.id],
            layout: deriveLayout(1),
          },
        };
      }

      return {
        ...current,
        projects,
        workspace: {
          ...current.workspace,
          projectId,
          panes: current.workspace.panes.map((pane) =>
            pane.id === activePaneId ? createPaneFromSession(optimisticSession, pane.id) : pane,
          ),
          selectedPaneIds: activePaneId ? [activePaneId] : [],
        },
      };
    });

    try {
      const createdSession = await createSession({
        projectId,
        title: `New session ${nextIndex}`,
        provider: options.provider === "codex" ? "openAi" : "anthropic",
        profileId: options.profileId,
      });
      const activePaneId = dashboard.workspace.activePaneId;
      if (activePaneId) {
        await replacePaneSession({
          paneId: activePaneId,
          sessionId: createdSession.id,
          title: createdSession.title,
          profileId: createdSession.profileId ?? options.profileId,
          focus: true,
        });
      } else {
        await openPane({
          sessionId: createdSession.id,
          title: createdSession.title,
          kind: "chat",
          profileId: createdSession.profileId ?? options.profileId,
          focus: true,
        });
      }
      await refreshFromBackend();
    } catch {
      // Keep optimistic preview.
    }
  }

  async function handleOpenSession(
    projectId: string,
    sessionId: string,
    mode: "replace" | "split" = "replace",
  ) {
    const project =
      dashboard.projects.find((candidate) => candidate.id === projectId) ?? null;
    const session =
      project?.sessions.find((candidate) => candidate.id === sessionId) ?? null;
    if (!project || !session) {
      return;
    }

    const existingPane = dashboard.workspace.panes.find((pane) => pane.sessionId === sessionId);
    if (existingPane && mode === "replace") {
      await handleFocusPane(existingPane.id, projectId);
      return;
    }

    if (mode === "split") {
      await handleAddPaneWithOptions({
        projectId,
        sessionId,
        profileId: session.profileId,
      });
      return;
    }

    const targetPaneId = dashboard.workspace.activePaneId;
    if (!targetPaneId) {
      setDashboard((current) => {
        const nextPane = createPaneFromSession(session);
        return {
          ...current,
          workspace: {
            ...current.workspace,
            projectId,
            panes: [nextPane],
            activePaneId: nextPane.id,
            selectedPaneIds: [nextPane.id],
            layout: deriveLayout(1),
          },
        };
      });

      try {
        await openPane({
          sessionId,
          title: session.title,
          kind: "chat",
          profileId: session.profileId,
          focus: true,
        });
        await refreshFromBackend();
      } catch {
        // Local preview mode fallback.
      }
      return;
    }

    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        projectId,
        panes: current.workspace.panes.map((pane) =>
          pane.id === targetPaneId ? createPaneFromSession(session, targetPaneId) : pane,
        ),
        activePaneId: targetPaneId,
        selectedPaneIds: [targetPaneId],
      },
    }));

    try {
      await replacePaneSession({
        paneId: targetPaneId,
        sessionId,
        title: session.title,
        profileId: session.profileId,
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
      projectId: project.id,
      sessionId: sourceSession.id,
      profileId: activePane?.profileId ?? sourceSession.profileId,
    });
  }

  async function handleAddPaneWithOptions(options: {
    projectId?: string;
    sessionId: string;
    profileId: string | null;
  }) {
    const project = options.projectId
      ? dashboard.projects.find((candidate) => candidate.id === options.projectId) ?? null
      : currentProject;
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
        providerSessionId: sourceSession.providerSessionId,
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
          projectId: project.id,
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

  async function handleFocusPane(paneId: string, projectId?: string) {
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        projectId: projectId ?? findProjectIdByPane(current.projects, current.workspace.panes, paneId),
        activePaneId: paneId,
        selectedPaneIds: [paneId],
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
    const optimisticTitle = deriveOptimisticSessionTitle(content);
    setDashboard((current) => ({
      ...current,
      projects: current.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          shouldRetitleSession(session.title, session.id, targetPaneIds, current.workspace.panes)
            ? { ...session, title: optimisticTitle }
            : session,
        ),
      })),
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          targetPaneIds.includes(pane.id)
            ? {
              ...pane,
              title: renamePaneTitleOptimistically(
                pane.title,
                optimisticTitle,
                pane.sessionId,
                [pane.id],
                current.workspace.panes,
              ),
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
    openSessionIds,
    openSessionCounts,
    paneProfiles,
    profiles,
    canAddPane,
    canClosePane,
    threadStats,
    handleCreateProject,
    handleDeleteProject,
    handleDeleteSession,
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

function createPaneFromSession(session: SessionSummary, paneId?: string): Pane {
  return {
    id: paneId ?? `pane-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: session.id,
    title: session.title,
    provider: session.provider,
    profileId: session.profileId,
    providerSessionId: session.providerSessionId,
    status: session.status,
    selected: false,
    messages: [createWorkspaceAttachedMessage(session.title)],
  };
}

function createWorkspaceAttachedMessage(title: string): Pane["messages"][number] {
  return {
    id: `message-${Math.random().toString(36).slice(2, 8)}`,
    kind: "session_meta",
    role: "system",
    body: `Workspace attached to ${title}.`,
    createdAt: new Date().toISOString(),
  };
}

function findProjectIdByPane(
  projects: Project[],
  panes: Pane[],
  paneId: string,
) {
  const pane = panes.find((candidate) => candidate.id === paneId);
  if (!pane) {
    return null;
  }

  return (
    projects.find((project) =>
      project.sessions.some((session) => session.id === pane.sessionId),
    )?.id ?? null
  );
}

function basename(path: string) {
  const normalized = path.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function shouldRetitleSession(
  title: string,
  sessionId: string,
  targetPaneIds: string[],
  panes: Pane[],
) {
  if (!title.trim().startsWith("New session")) {
    return false;
  }

  return targetPaneIds.some((paneId) => {
    const pane = panes.find((candidate) => candidate.id === paneId);
    return pane?.sessionId === sessionId;
  });
}

function renamePaneTitleOptimistically(
  title: string,
  optimisticTitle: string,
  sessionId: string,
  targetPaneIds: string[],
  panes: Pane[],
) {
  if (!shouldRetitleSession(title, sessionId, targetPaneIds, panes)) {
    return title;
  }

  const match = title.match(/^New session.*?( \/ Pane \d+)?$/);
  return match?.[1] ? `${optimisticTitle}${match[1]}` : optimisticTitle;
}

function deriveOptimisticSessionTitle(content: string) {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "New session";

  return truncateTitle(firstLine, 40);
}

function truncateTitle(value: string, maxChars: number) {
  const chars = Array.from(value);
  return chars.length > maxChars ? `${chars.slice(0, maxChars).join("")}…` : value;
}
