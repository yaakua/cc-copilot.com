import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  assignPaneProfile,
  assignPaneProvider,
  closePane,
  createProject,
  createSession,
  deleteProject,
  deleteProviderProfile,
  deleteSession,
  focusPane,
  getDashboardState,
  getProviderAccountStatus,
  inspectProviderAccountStatus,
  getRemoteStatus,
  launchProviderLogin,
  openPane,
  replacePaneSession,
  retryComposerStream,
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
  ConversationEvent,
  DashboardState,
  Pane,
  ProfileEditorIntent,
  ProviderProfile,
  ProviderSetupPrompt,
  Project,
  SessionSummary,
} from "../types/domain";

export function useDashboard() {
  const [dashboard, setDashboard] = useState<DashboardState>(() => createMockDashboardState());
  const [composerValue, setComposerValue] = useState("");
  const [isHydrating, setIsHydrating] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [providerSetupPrompt, setProviderSetupPrompt] = useState<ProviderSetupPrompt | null>(null);
  const [profileEditorIntent, setProfileEditorIntent] = useState<ProfileEditorIntent | null>(null);
  const dashboardRef = useRef(dashboard);
  const pendingProviderSetupRef = useRef<{
    projectId: string;
    provider: "claude" | "codex";
  } | null>(null);
  const streamQueuesRef = useRef<Map<string, StreamQueueEntry>>(new Map());
  const streamTimerRef = useRef<number | null>(null);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

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

        setDashboard((current) =>
          mergeDashboardStateWithDraftPanes(
            current,
            normalizeDashboardState(dashboardState, remoteState),
          ),
        );
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

    const appendDelta = (
      paneId: string,
      messageId: string,
      role: "assistant" | "system",
      kind: "message" | "status" | "tool_call" | "tool_result" | "error",
      chunk: string,
    ) => {
      if (!chunk) {
        return;
      }

      setDashboard((current) => ({
        ...current,
        projects: current.projects.map((project) => ({
          ...project,
          sessions: project.sessions.map((session) =>
            current.workspace.panes.some(
              (pane) => pane.id === paneId && pane.sessionId === session.id,
            )
              ? { ...session, status: kind === "error" ? "error" : "running" }
              : session,
          ),
        })),
        workspace: {
          ...current.workspace,
          panes: current.workspace.panes.map((pane) => {
            if (pane.id !== paneId) {
              return pane;
            }

            const messageKind = kind;
            const existingMessage = pane.messages.find(
              (message) => message.id === messageId,
            );

            if (existingMessage) {
              return {
                ...pane,
                status: kind === "error" ? "error" : "running",
                messages: pane.messages.map((message) =>
                  message.id === messageId
                    ? {
                      ...message,
                      kind: messageKind,
                      body:
                        kind === "tool_result" || kind === "status"
                          ? chunk
                          : `${message.body}${chunk}`,
                    }
                    : message,
                ),
              };
            }

            return {
              ...pane,
              status: kind === "error" ? "error" : "running",
              messages: [
                ...pane.messages,
                {
                  id: messageId,
                  kind: messageKind,
                  role,
                  body: chunk,
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }),
        },
      }));
    };

    const flushQueuedChunks = () => {
      const queue = streamQueuesRef.current;
      if (queue.size === 0) {
        if (streamTimerRef.current !== null) {
          window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        return;
      }

      for (const [key, entry] of queue.entries()) {
        const nextChunk = entry.chunks.shift();
        if (nextChunk) {
          appendDelta(
            entry.paneId,
            entry.messageId,
            entry.role,
            entry.kind,
            nextChunk,
          );
        }
        if (entry.chunks.length === 0) {
          queue.delete(key);
        }
      }

      if (queue.size === 0 && streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };

    const ensureStreamTimer = () => {
      if (streamTimerRef.current !== null) {
        return;
      }
      streamTimerRef.current = window.setInterval(flushQueuedChunks, 24);
    };

    const queueDelta = (
      paneId: string,
      messageId: string,
      role: "assistant" | "system",
      kind: "message" | "status" | "tool_call" | "tool_result" | "error",
      chunk: string,
    ) => {
      const segments =
        kind === "status" || kind === "tool_call" || kind === "tool_result"
          ? [chunk]
          : segmentStreamChunk(chunk);
      if (segments.length === 0) {
        return;
      }

      const key = `${paneId}:${messageId}:${role}:${kind}`;
      const existing = streamQueuesRef.current.get(key);
      if (existing) {
        existing.chunks.push(...segments);
      } else {
        streamQueuesRef.current.set(key, {
          paneId,
          messageId,
          role,
          kind,
          chunks: segments,
        });
      }

      ensureStreamTimer();
    };

    const flushAllQueuedChunks = () => {
      while (streamQueuesRef.current.size > 0) {
        flushQueuedChunks();
      }
    };

    const unlistenPromise = onComposerStream((event) => {
      if (disposed) {
        return;
      }

      if (event.stage === "started") {
        setRequestError(null);
        if (event.chunk && (event.role === "assistant" || event.role === "system")) {
          queueDelta(
            event.paneId,
            event.messageId,
            event.role,
            mapStreamEventKind(event.kind),
            event.chunk,
          );
        }
        return;
      }

      if (event.stage === "delta") {
        const chunk = event.chunk ?? "";
        if (event.role === "assistant" || event.role === "system") {
          queueDelta(
            event.paneId,
            event.messageId,
            event.role,
            mapStreamEventKind(event.kind),
            chunk,
          );
        }
        return;
      }

      if (event.stage === "failed") {
        const failureMessage = event.chunk ?? "Streaming request failed.";
        setRequestError(failureMessage);

        const authPrompt = resolveProviderSetupPrompt(
          dashboardRef.current,
          event.paneId,
          failureMessage,
        );
        if (authPrompt) {
          pendingProviderSetupRef.current = {
            projectId: authPrompt.projectId,
            provider: authPrompt.provider,
          };
          setProviderSetupPrompt(authPrompt);
        }
      }

      flushAllQueuedChunks();
      void refreshFromBackend();
    });

    return () => {
      disposed = true;
      flushAllQueuedChunks();
      if (streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
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
      setDashboard((current) =>
        mergeDashboardStateWithDraftPanes(current, normalizeDashboardState(next, remote)),
      );
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

  async function createSessionWithOptions(
    projectId: string,
    options: { provider: "claude" | "codex"; profileId: string | null },
  ) {
    pendingProviderSetupRef.current = null;
    setProviderSetupPrompt(null);
    const nextDraftPane = createDraftPane(options.provider, options.profileId);

    setDashboard((current) => {
      const activePaneId = current.workspace.activePaneId;
      const hasActivePane = Boolean(activePaneId);

      if (!hasActivePane) {
        return {
          ...current,
          workspace: {
            ...current.workspace,
            projectId,
            panes: [nextDraftPane],
            activePaneId: nextDraftPane.id,
            selectedPaneIds: [nextDraftPane.id],
            layout: deriveLayout(1),
          },
        };
      }

      return {
        ...current,
        workspace: {
          ...current.workspace,
          projectId,
          panes: current.workspace.panes.map((pane) =>
            pane.id === activePaneId
              ? {
                ...nextDraftPane,
                id: pane.id,
              }
              : pane,
          ),
          selectedPaneIds: activePaneId ? [activePaneId] : [],
        },
      };
    });
  }

  async function handleCreateSessionWithOptions(
    projectId: string,
    options: { provider: "claude" | "codex"; profileId: string | null },
  ) {
    return createSessionWithOptions(projectId, options);
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
      const reusableDraftPane = dashboard.workspace.panes.find(
        (pane) => pane.id === dashboard.workspace.activePaneId && pane.isDraft,
      );

      if (reusableDraftPane) {
        setDashboard((current) => ({
          ...current,
          workspace: {
            ...current.workspace,
            projectId,
            panes: current.workspace.panes.map((pane) =>
              pane.id === reusableDraftPane.id
                ? createPaneFromSession(session, reusableDraftPane.id)
                : pane,
            ),
            activePaneId: reusableDraftPane.id,
            selectedPaneIds: [reusableDraftPane.id],
          },
        }));

        try {
          const openedPane = await openPane({
            sessionId,
            title: session.title,
            kind: "chat",
            profileId: session.profileId,
            focus: true,
          });

          setDashboard((current) => ({
            ...current,
            workspace: {
              ...current.workspace,
              panes: current.workspace.panes.map((pane) =>
                pane.id === reusableDraftPane.id
                  ? {
                    ...createPaneFromSession(session, openedPane.id),
                    messages:
                      current.workspace.panes.find((candidate) => candidate.id === reusableDraftPane.id)
                        ?.messages ?? [createWorkspaceAttachedMessage(session.title)],
                  }
                  : pane,
              ),
              activePaneId:
                current.workspace.activePaneId === reusableDraftPane.id
                  ? openedPane.id
                  : current.workspace.activePaneId,
              selectedPaneIds: current.workspace.selectedPaneIds.map((id) =>
                id === reusableDraftPane.id ? openedPane.id : id,
              ),
            },
          }));

          await refreshFromBackend();
        } catch {
          // Local preview mode fallback.
        }
        return;
      }

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
    const nextPane = createDraftPane(
      activePane?.provider ?? defaultProvider,
      activePane?.profileId ?? null,
    );
    setDashboard((current) => {
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

    const targetPane =
      dashboard.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
    if (targetPane?.isDraft) {
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
    const pane =
      dashboard.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        projectId:
          projectId ??
          findProjectIdByPane(current.projects, current.workspace.panes, paneId) ??
          current.workspace.projectId,
        activePaneId: paneId,
        selectedPaneIds: [paneId],
      },
    }));

    if (pane?.isDraft) {
      return;
    }

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
    const targetPane =
      dashboard.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          pane.id === paneId ? { ...pane, profileId: profileId || null } : pane,
        ),
      },
    }));

    if (targetPane?.isDraft) {
      return;
    }

    try {
      await assignPaneProfile({ paneId, profileId: profileId || null });
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Profile binding failed.");
    }
  }

  async function handleSetPaneProvider(
    paneId: string,
    provider: "claude" | "codex",
  ) {
    const defaultProfileId = defaultProfileForProvider(profiles, provider)?.id ?? null;
    const targetPane =
      dashboard.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;

    setDashboard((current) => ({
      ...current,
      projects: current.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === targetPane?.sessionId
            ? {
              ...session,
              provider,
              profileId: defaultProfileId,
              providerSessionId: null,
            }
            : session,
        ),
      })),
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          pane.id === paneId
            ? {
              ...pane,
              provider,
              profileId: defaultProfileId,
              providerSessionId: null,
            }
            : pane,
        ),
      },
    }));

    if (targetPane?.isDraft) {
      return;
    }

    try {
      await assignPaneProvider({
        paneId,
        provider: provider === "codex" ? "openAi" : "anthropic",
        profileId: defaultProfileId,
      });
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Provider switch failed.");
      await refreshFromBackend();
    }
  }

  async function handleSaveProfile(profile: {
    id?: string | null;
    provider: "claude" | "codex";
    label: string;
    authKind: "apiKey" | "official" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
    reuseCurrentLogin?: boolean | null;
    confirmedAccountEmail?: string | null;
  }) {
    try {
      const savedProfile = await saveProviderProfile({
        id: profile.id ?? null,
        provider: profile.provider === "codex" ? "openAi" : "anthropic",
        label: profile.label,
        authKind: profile.authKind,
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: profile.model ?? null,
        reuseCurrentLogin: profile.reuseCurrentLogin ?? false,
      });
      setRequestError(null);
      await refreshFromBackend();

      if (
        savedProfile &&
        typeof savedProfile === "object" &&
        "id" in savedProfile &&
        typeof savedProfile.id === "string"
      ) {
        const targetPaneId = profileEditorIntent?.targetPaneId ?? null;
        if (targetPaneId) {
          await handleAssignProfileToPane(targetPaneId, savedProfile.id);
        }
        if (profile.authKind === "official" && !profile.reuseCurrentLogin) {
          await handleLaunchProviderLogin(profile.provider, savedProfile.id);
        } else if (profile.authKind === "official" && profile.reuseCurrentLogin) {
          setRequestError(
            profile.confirmedAccountEmail
              ? `已保存并复用当前登录账号：${profile.confirmedAccountEmail}`
              : "已保存并复用当前登录账号。",
          );
        }
      }

      const pendingSetup = pendingProviderSetupRef.current;
      if (
        pendingSetup &&
        pendingSetup.provider === profile.provider &&
        profile.authKind === "apiKey" &&
        savedProfile &&
        typeof savedProfile === "object" &&
        "id" in savedProfile &&
        typeof savedProfile.id === "string"
      ) {
        setProfileEditorIntent(null);
        await createSessionWithOptions(pendingSetup.projectId, {
          provider: profile.provider,
          profileId: savedProfile.id,
        });
      }
      return savedProfile;
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Profile save failed.");
      throw error;
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
    authKind: "apiKey" | "official" | "system";
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

  async function handleInspectProviderAccount(profile: {
    provider: "claude" | "codex";
    profileId?: string | null;
  }) {
    return inspectProviderAccountStatus({
      provider: profile.provider === "codex" ? "openAi" : "anthropic",
      profileId: profile.profileId ?? null,
    });
  }

  async function handleLaunchProviderLogin(
    provider: "claude" | "codex",
    profileId?: string | null,
  ) {
    try {
      const result = await launchProviderLogin({
        provider: provider === "codex" ? "openAi" : "anthropic",
        profileId: profileId ?? null,
      });
      setRequestError(result.message);
      await refreshFromBackend();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Unable to open provider login.");
    }
  }

  function handleDismissProviderSetupPrompt() {
    pendingProviderSetupRef.current = null;
    setProviderSetupPrompt(null);
  }

  async function handleRetryProviderSetupPrompt() {
    if (!providerSetupPrompt?.paneId) {
      return;
    }
    await retryLastMessageForPane(providerSetupPrompt.paneId);
    setProviderSetupPrompt(null);
  }

  async function handleCreateSessionWithProfileFromPrompt(profileId: string) {
    if (!providerSetupPrompt) {
      return;
    }
    await createSessionWithOptions(providerSetupPrompt.projectId, {
      provider: providerSetupPrompt.provider,
      profileId,
    });
  }

  function handleConfigureThirdPartyProviderFromPrompt() {
    const pendingSetup = pendingProviderSetupRef.current;
    if (!pendingSetup) {
      return;
    }
    setProfileEditorIntent({
      provider: pendingSetup.provider,
      authKind: "apiKey",
      targetPaneId: providerSetupPrompt?.paneId ?? null,
      requestId: Date.now(),
    });
    setProviderSetupPrompt(null);
  }

  function handleConsumeProfileEditorIntent() {
    setProfileEditorIntent(null);
  }

  function handleStartProfileCreation(
    provider: "claude" | "codex",
    authKind: "apiKey" | "official" | "system" = provider === "codex" ? "official" : "system",
    targetPaneId?: string | null,
  ) {
    setProfileEditorIntent({
      provider,
      authKind,
      targetPaneId: targetPaneId ?? null,
      requestId: Date.now(),
    });
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

    await dispatchMessage(content, targetMode);
    setComposerValue("");
  }

  async function dispatchMessage(content: string, targetMode: ComposerTargetMode) {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    const initialTargetPaneIds = resolveTargetPaneIds(
      dashboard.workspace.panes,
      dashboard.workspace.activePaneId,
      dashboard.workspace.selectedPaneIds,
      targetMode,
    );
    if (initialTargetPaneIds.length === 0) {
      return;
    }

    const materializedPaneIds = await Promise.all(
      initialTargetPaneIds.map((paneId) => ensurePaneReadyForSend(paneId)),
    );
    const targetPaneIds = materializedPaneIds.filter((paneId): paneId is string => Boolean(paneId));
    if (targetPaneIds.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    const preservesSessionTitle = looksLikeSessionMetaCommand(normalizedContent);
    const optimisticTitle = preservesSessionTitle
      ? null
      : deriveOptimisticSessionTitle(normalizedContent);
    const localCommandResults = new Map<string, LocalPaneCommandResult>();
    const localCommandEntries = await Promise.all(
      targetPaneIds.map(async (paneId) => {
        const pane =
          dashboard.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
        if (!pane) {
          return [paneId, null] as const;
        }
        const localResult = await resolveLocalPaneCommand(
          dashboard,
          pane,
          profiles,
          normalizedContent,
        );
        return [paneId, localResult] as const;
      }),
    );

    for (const [paneId, localResult] of localCommandEntries) {
      if (localResult) {
        localCommandResults.set(paneId, localResult);
      }
    }

    const remotePaneIds = targetPaneIds.filter((paneId) => !localCommandResults.has(paneId));
    setDashboard((current) => ({
      ...current,
      projects: current.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          optimisticTitle &&
            shouldRetitleSession(session.title, session.id, targetPaneIds, current.workspace.panes)
            ? {
              ...session,
              title: optimisticTitle,
              status: sessionHasRemoteTargets(session.id, remotePaneIds, current.workspace.panes)
                ? "running"
                : session.status,
            }
            : sessionHasRemoteTargets(session.id, remotePaneIds, current.workspace.panes)
              ? { ...session, status: "running" }
              : session,
        ),
      })),
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          targetPaneIds.includes(pane.id)
            ? {
              ...pane,
              title:
                optimisticTitle &&
                  shouldRetitleSession(
                    pane.title,
                    pane.sessionId,
                    [pane.id],
                    current.workspace.panes,
                  )
                  ? renamePaneTitleOptimistically(
                    pane.title,
                    optimisticTitle,
                    pane.sessionId,
                    [pane.id],
                    current.workspace.panes,
                  )
                  : pane.title,
              status: localCommandResults.has(pane.id) ? "idle" : "running",
              messages: appendOptimisticMessages(
                pane.messages,
                normalizedContent,
                createdAt,
                localCommandResults.get(pane.id) ?? null,
              ),
            }
            : pane,
        ),
      },
    }));

    if (remotePaneIds.length === 0) {
      setRequestError(null);
      return;
    }

    try {
      await Promise.all(
        remotePaneIds.map((paneId) => startComposerStream({ paneId, content: normalizedContent })),
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
      projects: current.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === activePane.sessionId ? { ...session, status: "running" } : session,
        ),
      })),
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

  async function retryLastMessageForPane(paneId: string) {
    const pane =
      dashboardRef.current.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
    if (!pane) {
      return;
    }

    const latestErrorMessage = [...pane.messages]
      .reverse()
      .find((message) => message.role === "system" && message.kind === "error");
    if (!latestErrorMessage) {
      return;
    }

    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        panes: current.workspace.panes.map((pane) =>
          pane.id === paneId
            ? {
              ...pane,
              status: "running",
              messages: pane.messages.filter((message) => message.id !== latestErrorMessage.id),
            }
            : pane,
        ),
      },
    }));

    try {
      await retryComposerStream({ paneId });
      setRequestError(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Retry failed.");
      await refreshFromBackend();
    }
  }

  async function handleRetryLastMessage() {
    if (!activePane) {
      return;
    }
    await retryLastMessageForPane(activePane.id);
  }

  async function ensurePaneReadyForSend(paneId: string) {
    const pane =
      dashboardRef.current.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
    if (!pane) {
      return null;
    }
    if (!pane.isDraft) {
      return pane.id;
    }

    const projectId = dashboardRef.current.workspace.projectId;
    if (!projectId) {
      setRequestError("No project selected for draft pane.");
      return null;
    }
    const project =
      dashboardRef.current.projects.find((candidate) => candidate.id === projectId) ?? null;
    if (!project) {
      setRequestError("Project not found for draft pane.");
      return null;
    }

    const nextIndex = project.sessions.length + 1;
    const createdSession = await createSession({
      projectId,
      title: `New session ${nextIndex}`,
      provider: pane.provider === "codex" ? "openAi" : "anthropic",
      profileId: pane.profileId,
    });
    const openedPane = await openPane({
      sessionId: createdSession.id,
      title: createdSession.title,
      kind: "chat",
      profileId: pane.profileId,
      focus: true,
    });

    setDashboard((current) => {
      const optimisticSession: SessionSummary = {
        id: createdSession.id,
        title: createdSession.title,
        createdAt: new Date(createdSession.createdAt).toISOString(),
        provider: pane.provider,
        profileId: createdSession.profileId ?? pane.profileId,
        providerSessionId: createdSession.providerSessionId ?? null,
        lastActiveAt: new Date(createdSession.updatedAt).toISOString(),
        status: "idle",
        imported: false,
        unreadCount: 0,
      };
      const nextPane: Pane = {
        id: openedPane.id,
        sessionId: createdSession.id,
        title: createdSession.title,
        provider: pane.provider,
        profileId: createdSession.profileId ?? pane.profileId,
        providerSessionId: createdSession.providerSessionId ?? null,
        status: "idle",
        selected: false,
        messages: [],
      };

      return {
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? {
              ...project,
              lastActiveAt: optimisticSession.lastActiveAt,
              sessions: [optimisticSession, ...project.sessions],
            }
            : project,
        ),
        workspace: {
          ...current.workspace,
          panes: current.workspace.panes.map((candidate) =>
            candidate.id === pane.id ? nextPane : candidate,
          ),
          activePaneId:
            current.workspace.activePaneId === pane.id ? openedPane.id : current.workspace.activePaneId,
          selectedPaneIds: current.workspace.selectedPaneIds.map((id) =>
            id === pane.id ? openedPane.id : id,
          ),
        },
      };
    });

    return openedPane.id;
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
    providerSetupPrompt,
    profileEditorIntent,
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
    setDraftPaneProvider: handleSetPaneProvider,
    assignProfileToPane: handleAssignProfileToPane,
    saveProfile: handleSaveProfile,
    deleteProfile: handleDeleteProfile,
    testProfile: handleTestProfile,
    inspectProviderAccount: handleInspectProviderAccount,
    dismissProviderSetupPrompt: handleDismissProviderSetupPrompt,
    retryProviderSetupPrompt: handleRetryProviderSetupPrompt,
    createSessionWithProfileFromPrompt: handleCreateSessionWithProfileFromPrompt,
    configureThirdPartyProviderFromPrompt: handleConfigureThirdPartyProviderFromPrompt,
    consumeProfileEditorIntent: handleConsumeProfileEditorIntent,
    startProfileCreation: handleStartProfileCreation,
    launchProviderLogin: handleLaunchProviderLogin,
    handleToggleRemote,
    handleSendMessage,
    handleRetryLastMessage,
    retryLastMessageForPane,
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

function createDraftPane(
  provider: "claude" | "codex",
  profileId: string | null,
): Pane {
  return {
    id: `draft-pane-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: `draft-session-${Math.random().toString(36).slice(2, 8)}`,
    title: "新建会话",
    provider,
    profileId,
    providerSessionId: null,
    status: "idle",
    isDraft: true,
    selected: false,
    messages: [],
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

function mergeDashboardStateWithDraftPanes(
  current: DashboardState,
  next: DashboardState,
): DashboardState {
  const draftPanes = current.workspace.panes.filter(
    (pane) => pane.isDraft && !next.workspace.panes.some((candidate) => candidate.id === pane.id),
  );
  if (draftPanes.length === 0) {
    return next;
  }

  const panes = [...next.workspace.panes, ...draftPanes];
  const paneIds = new Set(panes.map((pane) => pane.id));
  const activePaneId = paneIds.has(current.workspace.activePaneId ?? "")
    ? current.workspace.activePaneId
    : paneIds.has(next.workspace.activePaneId ?? "")
      ? next.workspace.activePaneId
      : panes[0]?.id ?? null;
  const selectedPaneIds = Array.from(
    new Set([
      ...next.workspace.selectedPaneIds.filter((paneId) => paneIds.has(paneId)),
      ...current.workspace.selectedPaneIds.filter((paneId) => paneIds.has(paneId)),
    ]),
  );

  return {
    ...next,
    workspace: {
      ...next.workspace,
      projectId: next.workspace.projectId ?? current.workspace.projectId,
      panes,
      activePaneId,
      selectedPaneIds:
        selectedPaneIds.length > 0 ? selectedPaneIds : activePaneId ? [activePaneId] : [],
      layout: deriveLayout(panes.length),
    },
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

function looksLikeSessionMetaCommand(content: string) {
  const trimmed = content.trim();
  return trimmed.startsWith("/") || trimmed.startsWith("$");
}

function resolveProviderSetupPrompt(
  dashboard: DashboardState,
  paneId: string,
  failureMessage: string,
): ProviderSetupPrompt | null {
  if (!looksLikeProviderAuthFailure(failureMessage)) {
    return null;
  }

  const pane = dashboard.workspace.panes.find((candidate) => candidate.id === paneId) ?? null;
  if (!pane) {
    return null;
  }
  const projectId = findProjectIdByPane(dashboard.projects, dashboard.workspace.panes, paneId);
  if (!projectId) {
    return null;
  }

  return {
    projectId,
    paneId,
    provider: pane.provider,
    failureMessage,
  };
}

function looksLikeProviderAuthFailure(message: string) {
  const normalized = message.toLowerCase();
  return [
    "not logged in",
    "run claude /login",
    "codex login",
    "login first",
    "api key missing",
    "unauthorized",
    "authentication",
    "invalid api key",
    "401",
  ].some((needle) => normalized.includes(needle));
}

function appendOptimisticMessages(
  existingMessages: ConversationEvent[],
  content: string,
  createdAt: string,
  localCommandResult: LocalPaneCommandResult | null,
) {
  const nextMessages: ConversationEvent[] = [
    ...existingMessages,
    {
      id: `message-${Math.random().toString(36).slice(2, 8)}`,
      kind: "message",
      role: "user",
      body: content,
      createdAt,
    },
  ];

  if (localCommandResult) {
    nextMessages.push({
      id: `message-${Math.random().toString(36).slice(2, 8)}`,
      kind: localCommandResult.kind,
      role: localCommandResult.role,
      body: localCommandResult.body,
      createdAt,
    });
  }

  return nextMessages;
}

function sessionHasRemoteTargets(sessionId: string, targetPaneIds: string[], panes: Pane[]) {
  return targetPaneIds.some((paneId) => {
    const pane = panes.find((candidate) => candidate.id === paneId);
    return pane?.sessionId === sessionId;
  });
}

interface LocalPaneCommandResult {
  kind: "status";
  role: "system";
  body: string;
}

async function resolveLocalPaneCommand(
  dashboard: DashboardState,
  pane: Pane,
  profiles: ProviderProfile[],
  content: string,
): Promise<LocalPaneCommandResult | null> {
  const command = normalizeLocalCommand(content);
  if (command !== "/status") {
    return null;
  }

  let accountStatus: Awaited<ReturnType<typeof getProviderAccountStatus>> | null = null;
  try {
    accountStatus = await getProviderAccountStatus({ paneId: pane.id });
  } catch {
    accountStatus = null;
  }

  return {
    kind: "status",
    role: "system",
    body: buildStatusCommandBody(dashboard, pane, profiles, accountStatus),
  };
}

function normalizeLocalCommand(content: string) {
  const command = content.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (command === "/stutus") {
    return "/status";
  }
  return command;
}

function buildStatusCommandBody(
  dashboard: DashboardState,
  pane: Pane,
  profiles: ProviderProfile[],
  accountStatus: Awaited<ReturnType<typeof getProviderAccountStatus>> | null,
) {
  const profile = profiles.find((candidate) => candidate.id === pane.profileId) ?? null;
  const project = findProjectBySessionId(dashboard.projects, pane.sessionId);
  const providerLabel = pane.provider === "codex" ? "Codex" : "Claude Code";
  const userMessageCount = pane.messages.filter((message) => message.role === "user").length;
  const conversationMessageCount = pane.messages.filter(
    (message) => message.kind !== "session_meta",
  ).length;
  const switchHint =
    userMessageCount === 0
      ? "当前还没发出第一条业务消息，仍可切换账号或 profile。"
      : "当前会话首条业务消息已发送，provider 已固定；如需切换 provider，请新建会话。";

  const lines = [
    `## ${providerLabel} 状态`,
    "",
    `- 会话标题: ${pane.title}`,
    `- Provider: ${providerLabel}`,
    `- 账号来源: ${describeProfile(profile, pane.provider)}`,
    `- 登录状态: ${describeLoginState(accountStatus)}`,
    `- 工作区: ${project?.path ? `\`${project.path}\`` : "未绑定工作区"}`,
    `- 当前 Pane: \`${pane.id}\``,
    `- 会话 ID: \`${pane.sessionId}\``,
    `- Provider Session: ${pane.providerSessionId ? `\`${pane.providerSessionId}\`` : "尚未建立"}`,
    `- 消息数: ${conversationMessageCount}`,
    `- 账号切换: ${switchHint}`,
  ];

  if (pane.provider === "codex" && profile?.runtimeHome) {
    lines.push(`- Runtime Home: \`${profile.runtimeHome}\``);
  }

  if (accountStatus?.accountEmail) {
    lines.splice(5, 0, `- 账号邮箱: \`${accountStatus.accountEmail}\``);
  }
  if (accountStatus?.accountPlan) {
    lines.splice(6, 0, `- 账号套餐: ${accountStatus.accountPlan}`);
  }
  if (accountStatus?.accountId) {
    lines.splice(7, 0, `- 账号 ID: \`${accountStatus.accountId}\``);
  }
  if (accountStatus?.authMode) {
    lines.splice(8, 0, `- 登录方式: ${accountStatus.authMode}`);
  }
  if (accountStatus?.runtimeHome && accountStatus.runtimeHome !== profile?.runtimeHome) {
    lines.push(`- Runtime Home: \`${accountStatus.runtimeHome}\``);
  }

  if (pane.provider === "claude") {
    lines.push("", "提示: 当前应用里的 Claude Code 运行链路是非交互模式，所以 `/status` 显示的是会话绑定状态，而不是 CLI 里的交互式面板。");
  } else {
    lines.push("", "提示: 这里展示的是应用侧的 Codex 会话状态，用来补齐桌面版里缺少的 CLI `/status` 面板信息。");
  }

  if (accountStatus?.note) {
    lines.push(accountStatus.note);
  }

  return lines.join("\n");
}

function describeLoginState(
  accountStatus: Awaited<ReturnType<typeof getProviderAccountStatus>> | null,
) {
  if (!accountStatus) {
    return "未读取到账号详情";
  }
  return accountStatus.isLoggedIn ? "已登录" : "未登录";
}

function describeProfile(
  profile: ProviderProfile | null,
  provider: "claude" | "codex",
) {
  if (!profile) {
    return provider === "codex" ? "系统默认官方账号" : "系统登录 / 官方账号";
  }

  const authLabel =
    profile.authKind === "apiKey"
      ? "第三方 Provider"
      : profile.authKind === "official"
        ? "官方账号"
        : "系统登录";

  return `${profile.label} (${authLabel})`;
}

function findProjectBySessionId(projects: Project[], sessionId: string) {
  return projects.find((project) =>
    project.sessions.some((session) => session.id === sessionId),
  ) ?? null;
}

interface StreamQueueEntry {
  paneId: string;
  messageId: string;
  role: "assistant" | "system";
  kind: "message" | "status" | "tool_call" | "tool_result" | "error";
  chunks: string[];
}

function mapStreamEventKind(
  kind: "message" | "status" | "toolCall" | "toolResult" | "error",
): "message" | "status" | "tool_call" | "tool_result" | "error" {
  if (kind === "toolCall") {
    return "tool_call";
  }
  if (kind === "toolResult") {
    return "tool_result";
  }
  return kind;
}

function segmentStreamChunk(chunk: string) {
  const text = chunk ?? "";
  if (!text) {
    return [];
  }

  if (text.length <= 48 && !text.includes("\n")) {
    return [text];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.startsWith("\n")) {
      parts.push("\n");
      remaining = remaining.slice(1);
      continue;
    }

    const slice = remaining.slice(0, 32);
    const newlineIndex = slice.lastIndexOf("\n");
    if (newlineIndex > 0) {
      parts.push(remaining.slice(0, newlineIndex + 1));
      remaining = remaining.slice(newlineIndex + 1);
      continue;
    }

    const breakIndex = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\t"));
    if (remaining.length > 32 && breakIndex > 12) {
      parts.push(remaining.slice(0, breakIndex + 1));
      remaining = remaining.slice(breakIndex + 1);
      continue;
    }

    parts.push(slice);
    remaining = remaining.slice(slice.length);
  }

  return parts.filter(Boolean);
}
