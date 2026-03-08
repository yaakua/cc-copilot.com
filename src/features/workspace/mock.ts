import type { DashboardState } from "../../types/domain";

export function createMockDashboardState(): DashboardState {
  return {
    projects: [],
    workspace: {
      projectId: null,
      layout: "single",
      activePaneId: null,
      selectedPaneIds: [],
      panes: [],
    },
    providerProfiles: [],
    providers: [],
    remote: {
      status: "idle",
      endpoint: null,
      authMode: "password",
      passwordHint: "Remote tunnel is not enabled.",
      lastHeartbeatAt: null,
    },
  };
}
