import type {
  ConversationEvent,
  DashboardState,
  Pane,
  RemoteState,
  ThreadStats,
} from "../types/domain";
import type {
  BackendConnectionState,
  BackendDashboardState,
  BackendProviderKind,
  BackendRemoteState,
  BackendSessionStatus,
} from "./backend";

export function normalizeDashboardState(
  backend: BackendDashboardState,
  remoteOverride?: BackendRemoteState,
): DashboardState {
  const sessionsByProject = new Map<string, DashboardState["projects"][number]["sessions"]>();
  const messagesBySession = new Map<string, ConversationEvent[]>();

  for (const message of backend.messages ?? []) {
    const list = messagesBySession.get(message.sessionId) ?? [];
    const kind =
      message.role === "system"
        ? /(unavailable|failed|reason:)/i.test(message.content)
          ? "error"
          : "status"
        : "message";
    list.push({
      id: message.id,
      kind,
      role: message.role,
      body: message.content,
      createdAt: new Date(message.createdAt).toISOString(),
    });
    messagesBySession.set(message.sessionId, list);
  }

  for (const session of backend.sessions) {
    const list = sessionsByProject.get(session.projectId) ?? [];
    list.push({
      id: session.id,
      title: session.title,
      provider: normalizeProvider(session.provider),
      profileId: session.profileId ?? null,
      providerSessionId: session.providerSessionId ?? null,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActiveAt: new Date(session.updatedAt).toISOString(),
      status: normalizeSessionStatus(session.status),
      imported: false,
      unreadCount: 0,
    });
    sessionsByProject.set(session.projectId, list);
  }

  const panes: Pane[] = backend.panes
    .filter((pane) => pane.status === "open")
    .map((pane) => {
      const session = backend.sessions.find((candidate) => candidate.id === pane.sessionId);
      const sessionMessages = messagesBySession.get(pane.sessionId);

      return {
        id: pane.id,
        sessionId: pane.sessionId,
        title: pane.title,
        provider: normalizeProvider(session?.provider ?? "mock"),
        profileId: pane.profileId ?? session?.profileId ?? null,
        providerSessionId: session?.providerSessionId ?? null,
        status: normalizeSessionStatus(session?.status ?? "idle"),
        selected: false,
        messages:
          sessionMessages && sessionMessages.length > 0
            ? sessionMessages
            : [
              {
                id: `meta-${pane.id}`,
                kind: "session_meta",
                role: "system",
                body: session?.lastMessagePreview ?? "Session attached.",
                createdAt: new Date().toISOString(),
              },
            ],
      };
    });

  return {
    projects: backend.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      lastActiveAt: new Date(project.updatedAt).toISOString(),
      sessions: sessionsByProject.get(project.id) ?? [],
    })),
    providers: backend.providers.map((provider) => ({
      id: normalizeProvider(provider.provider),
      label:
        provider.provider === "anthropic"
          ? "Claude Code"
          : provider.provider === "openAi"
            ? "Codex CLI"
            : "Mock Provider",
      availability: normalizeAvailability(provider.status),
      description: provider.note,
      capabilities:
        provider.provider === "anthropic"
          ? ["create", "resume", "stream-json"]
          : provider.provider === "openAi"
            ? ["create", "resume", "exec-json"]
            : ["mock"],
    })),
    providerProfiles: (backend.providerProfiles ?? []).map((profile) => ({
      id: profile.id,
      provider: normalizeProvider(profile.provider),
      label: profile.label,
      authKind: profile.authKind ?? "apiKey",
      baseUrl: profile.baseUrl,
      model: profile.model ?? null,
      apiKeyPresent: profile.apiKeyPresent,
      runtimeHome: profile.runtimeHome ?? null,
    })),
    workspace: {
      projectId: backend.activeProjectId ?? backend.projects[0]?.id ?? null,
      panes,
      activePaneId:
        panes.find((pane) => pane.sessionId === backend.activeSessionId)?.id ??
        panes.find((pane) =>
          backend.panes.find((candidate) => candidate.id === pane.id)?.isFocused,
        )?.id ??
        panes[0]?.id ??
        null,
      selectedPaneIds: panes
        .filter((pane) =>
          backend.panes.find((candidate) => candidate.id === pane.id)?.isFocused,
        )
        .map((pane) => pane.id),
      layout: deriveLayout(panes.length),
    },
    remote: normalizeRemote(remoteOverride ?? backend.remote),
  };
}

export function normalizeRemote(remote: BackendRemoteState): RemoteState {
  return {
    status:
      remote.frp.status === "connected"
        ? "online"
        : remote.frp.status === "degraded"
          ? "connecting"
          : "idle",
    endpoint: remote.frp.enabled ? remote.frp.serverAddr : null,
    authMode: "password",
    passwordHint: remote.frp.note,
    lastHeartbeatAt: new Date(remote.updatedAt).toISOString(),
  };
}

export function deriveLayout(paneCount: number) {
  if (paneCount >= 4) {
    return "quad";
  }
  if (paneCount === 3) {
    return "triple";
  }
  if (paneCount === 2) {
    return "dual";
  }
  return "single";
}

export function buildThreadStats(messages: ConversationEvent[]): ThreadStats {
  return messages.reduce(
    (stats, message) => {
      if (message.role === "assistant") {
        stats.positive += 38;
      }
      if (message.role === "system" && message.kind === "error") {
        stats.negative += 8;
      }
      return stats;
    },
    { positive: 0, negative: 0 },
  );
}

function normalizeProvider(provider: BackendProviderKind): Pane["provider"] {
  return provider === "anthropic" ? "claude" : provider === "openAi" ? "codex" : "claude";
}

function normalizeSessionStatus(status: BackendSessionStatus): Pane["status"] {
  if (status === "busy") {
    return "running";
  }
  if (status === "error") {
    return "error";
  }
  return "idle";
}

function normalizeAvailability(status: BackendConnectionState) {
  if (status === "connected") {
    return "ready";
  }
  if (status === "degraded") {
    return "warning";
  }
  return "missing";
}
