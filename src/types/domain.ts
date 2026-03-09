export type ProviderKind = "claude" | "codex";
export type SessionStatus = "idle" | "running" | "awaiting_input" | "error";
export type WorkspaceLayout = "single" | "dual" | "triple" | "quad";
export type ComposerTargetMode = "active" | "selected" | "all";
export type ConversationEventKind =
  | "message"
  | "tool_call"
  | "tool_result"
  | "status"
  | "approval_request"
  | "error"
  | "session_meta";

export interface ConversationEvent {
  id: string;
  kind: ConversationEventKind;
  role: "user" | "assistant" | "system" | "tool";
  body: string;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  provider: ProviderKind;
  profileId: string | null;
  providerSessionId: string | null;
  lastActiveAt: string;
  status: SessionStatus;
  imported: boolean;
  unreadCount: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: SessionSummary[];
  lastActiveAt: string;
}

export interface Pane {
  id: string;
  sessionId: string;
  title: string;
  provider: ProviderKind;
  profileId: string | null;
  providerSessionId: string | null;
  status: SessionStatus;
  isDraft?: boolean;
  selected: boolean;
  messages: ConversationEvent[];
}

export interface WorkspaceState {
  projectId: string | null;
  panes: Pane[];
  activePaneId: string | null;
  selectedPaneIds: string[];
  layout: WorkspaceLayout;
}

export interface ProviderState {
  id: ProviderKind;
  label: string;
  availability: "ready" | "missing" | "warning";
  description: string;
  capabilities: string[];
}

export interface ProviderProfile {
  id: string;
  provider: ProviderKind;
  label: string;
  authKind: "apiKey" | "official" | "system";
  baseUrl: string;
  model: string | null;
  apiKeyPresent: boolean;
  runtimeHome?: string | null;
}

export interface ProviderSetupPrompt {
  projectId: string;
  paneId?: string | null;
  provider: ProviderKind;
  failureMessage: string;
}

export interface ProfileEditorIntent {
  provider: ProviderKind;
  authKind: "apiKey" | "official" | "system";
  targetPaneId?: string | null;
  requestId: number;
}

export interface RemoteState {
  status: "idle" | "connecting" | "online";
  endpoint: string | null;
  authMode: "password";
  passwordHint: string;
  lastHeartbeatAt: string | null;
}

export interface DashboardState {
  projects: Project[];
  workspace: WorkspaceState;
  providers: ProviderState[];
  providerProfiles: ProviderProfile[];
  remote: RemoteState;
}

export interface ThreadStats {
  positive: number;
  negative: number;
}
