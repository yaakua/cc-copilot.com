import type { DashboardState } from "../../types/domain";

export function createMockDashboardState(): DashboardState {
  return {
    projects: [
      {
        id: "project-1",
        name: "cc-copilot-next",
        path: "/Users/yangkui/workspace/github/cc-copilot-next",
        lastActiveAt: "2026-03-08T10:00:00.000Z",
        sessions: [
          {
            id: "session-claude-1",
            title: "Refactor provider router",
            provider: "claude",
            profileId: "profile-claude-default",
            lastActiveAt: "2026-03-08T10:04:00.000Z",
            status: "running",
            imported: false,
            unreadCount: 2,
          },
          {
            id: "session-codex-1",
            title: "Review pane orchestration",
            provider: "codex",
            profileId: "profile-codex-default",
            lastActiveAt: "2026-03-08T09:58:00.000Z",
            status: "idle",
            imported: true,
            unreadCount: 0,
          },
        ],
      },
      {
        id: "project-2",
        name: "mobile-remote-console",
        path: "/Users/yangkui/workspace/github/mobile-remote-console",
        lastActiveAt: "2026-03-08T09:32:00.000Z",
        sessions: [
          {
            id: "session-claude-2",
            title: "Phone auth flow",
            provider: "claude",
            profileId: null,
            lastActiveAt: "2026-03-08T09:33:00.000Z",
            status: "awaiting_input",
            imported: false,
            unreadCount: 1,
          },
        ],
      },
    ],
    workspace: {
      projectId: "project-1",
      layout: "single",
      activePaneId: "pane-claude",
      selectedPaneIds: ["pane-claude"],
      panes: [
        {
          id: "pane-claude",
          sessionId: "session-claude-1",
          title: "Refactor provider router",
          provider: "claude",
          profileId: "profile-claude-default",
          status: "running",
          selected: true,
          messages: [
            {
              id: "evt-1",
              kind: "session_meta",
              role: "system",
              body: "Claude pane restored from local workspace database.",
              createdAt: "2026-03-08T10:03:00.000Z",
            },
            {
              id: "evt-2",
              kind: "message",
              role: "assistant",
              body: "I can split the adapter into detect, streamEvents, and cancel without exposing the terminal.",
              createdAt: "2026-03-08T10:04:00.000Z",
            },
          ],
        },
      ],
    },
    providerProfiles: [
      {
        id: "profile-claude-default",
        provider: "claude",
        label: "Claude Primary",
        authKind: "system",
        baseUrl: "",
        model: null,
        apiKeyPresent: false,
      },
      {
        id: "profile-codex-default",
        provider: "codex",
        label: "Codex Primary",
        authKind: "system",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5-codex",
        apiKeyPresent: false,
      },
    ],
    providers: [
      {
        id: "claude",
        label: "Claude Code",
        availability: "ready",
        description: "SDK / stream-json first, provider sidecar fallback.",
        capabilities: ["create", "resume", "stream-json", "approval"],
      },
      {
        id: "codex",
        label: "Codex CLI",
        availability: "warning",
        description: "JSON execution path enabled, interactive fallback pending.",
        capabilities: ["create", "resume", "exec-json"],
      },
    ],
    remote: {
      status: "idle",
      endpoint: null,
      authMode: "password",
      passwordHint: "Use a six digit device password.",
      lastHeartbeatAt: null,
    },
  };
}
