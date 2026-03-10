import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const COMMANDS = {
  createProject: "create_project",
  deleteProject: "delete_project",
  createSession: "create_session",
  deleteSession: "delete_session",
  saveProviderProfile: "save_provider_profile",
  deleteProviderProfile: "delete_provider_profile",
  assignPaneProfile: "assign_pane_profile",
  assignPaneProvider: "assign_pane_provider",
  testProviderProfile: "test_provider_profile",
  launchProviderLogin: "launch_provider_login",
  inspectProviderAccountStatus: "inspect_provider_account_status",
  openPane: "open_pane",
  replacePaneSession: "replace_pane_session",
  closePane: "close_pane",
  focusPane: "focus_pane",
  getDashboardState: "get_dashboard_state",
  getProviderAccountStatus: "get_provider_account_status",
  getAvailableSkills: "get_available_skills",
  getLogFilePath: "get_log_file_path",
  getRemoteStatus: "get_remote_status",
  sendComposerMessage: "send_composer_message",
  startComposerStream: "start_composer_stream",
  retryComposerStream: "retry_composer_stream",
  cancelPaneRun: "cancel_pane_run",
  toggleRemoteTunnel: "toggle_remote_tunnel",
} as const;

export type BackendProviderKind = "anthropic" | "openAi" | "mock";
export type BackendConnectionState = "connected" | "degraded" | "disconnected";
export type BackendSessionStatus = "idle" | "busy" | "error";

export interface BackendRemoteState {
  connection: BackendConnectionState;
  frp: {
    enabled: boolean;
    serverAddr: string;
    status: BackendConnectionState;
    note: string;
  };
  updatedAt: number;
}

export interface BackendMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

export interface BackendDashboardState {
  projects: Array<{
    id: string;
    name: string;
    path: string;
    sessionIds: string[];
    updatedAt: number;
  }>;
  sessions: Array<{
    id: string;
    projectId: string;
    title: string;
    provider: BackendProviderKind;
    profileId?: string | null;
    providerSessionId?: string | null;
    status: BackendSessionStatus;
    createdAt: number;
    updatedAt: number;
    lastMessagePreview: string;
  }>;
  panes: Array<{
    id: string;
    sessionId: string;
    title: string;
    profileId?: string | null;
    status: "open" | "closed";
    isFocused: boolean;
  }>;
  providerProfiles?: Array<{
    id: string;
    provider: BackendProviderKind;
    label: string;
    authKind?: "apiKey" | "official" | "system";
    baseUrl: string;
    model?: string | null;
    apiKeyPresent: boolean;
    apiKeyPreview?: string | null;
    runtimeHome?: string | null;
  }>;
  providers: Array<{
    provider: BackendProviderKind;
    status: BackendConnectionState;
    note: string;
    latencyMs: number;
  }>;
  messages?: BackendMessageRecord[];
  remote: BackendRemoteState;
  activeProjectId?: string | null;
  activeSessionId?: string | null;
}

export interface BackendSessionRecord {
  id: string;
  projectId: string;
  title: string;
  provider: BackendProviderKind;
  profileId?: string | null;
  providerSessionId?: string | null;
  status: BackendSessionStatus;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
}

export interface BackendComposerStreamEvent {
  paneId: string;
  sessionId: string;
  messageId: string;
  stage: "started" | "delta" | "finished" | "failed";
  kind: "message" | "status" | "toolCall" | "toolResult" | "error";
  role: "user" | "assistant" | "system";
  chunk?: string | null;
}

export interface BackendProviderConnectionTestResult {
  provider: BackendProviderKind;
  ok: boolean;
  latencyMs: number;
  message: string;
}

export interface BackendProviderAuthLaunchResult {
  provider: BackendProviderKind;
  message: string;
}

export interface BackendProviderAccountStatus {
  provider: BackendProviderKind;
  isLoggedIn: boolean;
  profileLabel?: string | null;
  authKind?: "apiKey" | "official" | "system" | null;
  authMode?: string | null;
  accountEmail?: string | null;
  accountPlan?: string | null;
  accountId?: string | null;
  runtimeHome?: string | null;
  note?: string | null;
}

export interface BackendSkillSummary {
  id: string;
  name: string;
  description: string;
  path: string;
  source: string;
}

export async function getDashboardState() {
  return invoke<BackendDashboardState>(COMMANDS.getDashboardState);
}

export async function getProviderAccountStatus(input: { paneId: string }) {
  return invoke<BackendProviderAccountStatus>(COMMANDS.getProviderAccountStatus, { input });
}

export async function inspectProviderAccountStatus(input: {
  provider: "anthropic" | "openAi";
  profileId?: string | null;
}) {
  return invoke<BackendProviderAccountStatus>(COMMANDS.inspectProviderAccountStatus, { input });
}

export async function getAvailableSkills() {
  return invoke<BackendSkillSummary[]>(COMMANDS.getAvailableSkills);
}

export async function getLogFilePath() {
  return invoke<string>(COMMANDS.getLogFilePath);
}

export async function getRemoteStatus() {
  return invoke<BackendRemoteState>(COMMANDS.getRemoteStatus);
}

export async function createProject(input: { name: string; path: string }) {
  return invoke(COMMANDS.createProject, { input });
}

export async function deleteProject(input: { projectId: string }) {
  return invoke(COMMANDS.deleteProject, { input });
}

export async function createSession(input: {
  projectId: string;
  title: string;
  provider: "anthropic" | "openAi";
  profileId?: string | null;
}) {
  return invoke<BackendSessionRecord>(COMMANDS.createSession, { input });
}

export async function deleteSession(input: { projectId: string; sessionId: string }) {
  return invoke<BackendSessionRecord>(COMMANDS.deleteSession, { input });
}

export async function saveProviderProfile(input: {
  id?: string | null;
  provider: "anthropic" | "openAi";
  label: string;
  authKind?: "apiKey" | "official" | "system";
  baseUrl: string;
  apiKey: string;
  model?: string | null;
  reuseCurrentLogin?: boolean | null;
}) {
  return invoke(COMMANDS.saveProviderProfile, { input });
}

export async function deleteProviderProfile(profileId: string) {
  return invoke(COMMANDS.deleteProviderProfile, { input: { profileId } });
}

export async function assignPaneProfile(input: {
  paneId: string;
  profileId?: string | null;
}) {
  return invoke(COMMANDS.assignPaneProfile, { input });
}

export async function assignPaneProvider(input: {
  paneId: string;
  provider: "anthropic" | "openAi";
  profileId?: string | null;
}) {
  return invoke(COMMANDS.assignPaneProvider, { input });
}

export async function testProviderProfile(input: {
  profileId?: string | null;
  provider: "anthropic" | "openAi";
  label?: string | null;
  authKind?: "apiKey" | "official" | "system";
  baseUrl: string;
  apiKey: string;
  model?: string | null;
}) {
  return invoke<BackendProviderConnectionTestResult>(COMMANDS.testProviderProfile, { input });
}

export async function launchProviderLogin(input: {
  provider: "anthropic" | "openAi";
  profileId?: string | null;
}) {
  return invoke<BackendProviderAuthLaunchResult>(COMMANDS.launchProviderLogin, { input });
}

export async function openPane(input: {
  sessionId: string;
  title: string;
  kind: "chat";
  profileId?: string | null;
  focus: boolean;
}) {
  return invoke<{
    id: string;
    sessionId: string;
    title: string;
    profileId?: string | null;
    status: "open" | "closed";
    isFocused: boolean;
  }>(COMMANDS.openPane, { input });
}

export async function replacePaneSession(input: {
  paneId: string;
  sessionId: string;
  title: string;
  profileId?: string | null;
  focus: boolean;
}) {
  return invoke(COMMANDS.replacePaneSession, { input });
}

export async function closePane(paneId: string) {
  return invoke(COMMANDS.closePane, { target: { paneId } });
}

export async function focusPane(paneId: string) {
  return invoke(COMMANDS.focusPane, { target: { paneId } });
}

export async function toggleRemoteTunnel(enabled: boolean) {
  return invoke<BackendRemoteState>(COMMANDS.toggleRemoteTunnel, { input: { enabled } });
}

export async function sendComposerMessage(input: { paneId: string; content: string }) {
  return invoke(COMMANDS.sendComposerMessage, { input });
}

export async function startComposerStream(input: { paneId: string; content: string }) {
  return invoke<void>(COMMANDS.startComposerStream, { input });
}

export async function retryComposerStream(input: { paneId: string }) {
  return invoke<void>(COMMANDS.retryComposerStream, { input });
}

export async function cancelPaneRun(input: { paneId: string }) {
  return invoke<void>(COMMANDS.cancelPaneRun, { input });
}

export function onComposerStream(
  handler: (event: BackendComposerStreamEvent) => void,
) {
  return listen<BackendComposerStreamEvent>("composer://stream", (event) => {
    handler(event.payload);
  });
}
