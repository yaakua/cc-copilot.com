use serde::{Deserialize, Serialize};

pub type TimestampMs = u64;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardState {
    pub workspace: WorkspaceSummary,
    pub projects: Vec<ProjectRecord>,
    pub remote: RemoteStatus,
    pub providers: Vec<ProviderHealth>,
    #[serde(default)]
    pub provider_profiles: Vec<ProviderProfileRecord>,
    pub sessions: Vec<SessionRecord>,
    pub panes: Vec<PaneRecord>,
    pub messages: Vec<ComposerMessage>,
    pub active_project_id: Option<String>,
    pub active_session_id: Option<String>,
    pub composer_drafts: Vec<ComposerDraft>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub app_name: String,
    pub layout_mode: String,
    pub provider_mode: String,
    pub last_sync_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub path: String,
    pub session_ids: Vec<String>,
    pub created_at: TimestampMs,
    pub updated_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub provider: ProviderKind,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub provider_session_id: Option<String>,
    pub status: SessionStatus,
    pub last_message_preview: String,
    pub created_at: TimestampMs,
    pub updated_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PaneRecord {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub kind: PaneKind,
    #[serde(default)]
    pub profile_id: Option<String>,
    pub status: PaneStatus,
    pub is_focused: bool,
    pub created_at: TimestampMs,
    pub updated_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComposerDraft {
    pub session_id: String,
    pub text: String,
    pub is_streaming: bool,
    pub updated_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComposerMessage {
    pub id: String,
    pub session_id: String,
    pub role: MessageRole,
    pub content: String,
    pub created_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendComposerMessageResult {
    pub message: ComposerMessage,
    pub assistant_message: ComposerMessage,
    pub session: SessionRecord,
    pub draft: ComposerDraft,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatus {
    pub connection: ConnectionState,
    pub frp: FrpStatus,
    pub provider_health: Vec<ProviderHealth>,
    pub updated_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FrpStatus {
    pub enabled: bool,
    pub server_addr: String,
    pub active_tunnels: u32,
    pub status: ConnectionState,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHealth {
    pub provider: ProviderKind,
    pub status: ConnectionState,
    pub latency_ms: u32,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfileRecord {
    pub id: String,
    pub provider: ProviderKind,
    pub label: String,
    #[serde(default = "default_profile_auth_kind")]
    pub auth_kind: ProfileAuthKind,
    pub base_url: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub api_key_present: bool,
    #[serde(default)]
    pub api_key_preview: Option<String>,
    #[serde(default)]
    pub runtime_home: Option<String>,
    pub created_at: TimestampMs,
    pub updated_at: TimestampMs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GetProviderAccountStatusInput {
    pub pane_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAccountStatus {
    pub provider: ProviderKind,
    pub is_logged_in: bool,
    #[serde(default)]
    pub profile_label: Option<String>,
    #[serde(default)]
    pub auth_kind: Option<ProfileAuthKind>,
    #[serde(default)]
    pub auth_mode: Option<String>,
    #[serde(default)]
    pub account_email: Option<String>,
    #[serde(default)]
    pub account_plan: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub runtime_home: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderKind {
    Anthropic,
    OpenAi,
    Mock,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProfileAuthKind {
    ApiKey,
    Official,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionStatus {
    Idle,
    Busy,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PaneKind {
    Chat,
    Diff,
    Logs,
    Preview,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PaneStatus {
    Open,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionState {
    Connected,
    Degraded,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProjectInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSessionInput {
    pub project_id: Option<String>,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionInput {
    pub project_id: String,
    pub title: String,
    pub provider: Option<ProviderKind>,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenPaneInput {
    pub session_id: String,
    pub title: String,
    pub kind: PaneKind,
    pub profile_id: Option<String>,
    pub focus: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReplacePaneSessionInput {
    pub pane_id: String,
    pub session_id: String,
    pub title: String,
    pub profile_id: Option<String>,
    pub focus: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PaneTarget {
    pub pane_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CancelPaneRunInput {
    pub pane_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendComposerMessageInput {
    pub pane_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RetryComposerMessageInput {
    pub pane_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetWorkspaceLayoutInput {
    pub layout_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToggleRemoteTunnelInput {
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveProviderProfileInput {
    pub id: Option<String>,
    pub provider: ProviderKind,
    pub label: String,
    pub auth_kind: Option<ProfileAuthKind>,
    pub base_url: String,
    pub api_key: String,
    pub model: Option<String>,
    pub reuse_current_login: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TestProviderProfileInput {
    pub profile_id: Option<String>,
    pub provider: ProviderKind,
    pub label: Option<String>,
    pub auth_kind: Option<ProfileAuthKind>,
    pub base_url: String,
    pub api_key: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionTestResult {
    pub provider: ProviderKind,
    pub ok: bool,
    pub latency_ms: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAuthLaunchResult {
    pub provider: ProviderKind,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProviderProfileInput {
    pub profile_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchProviderLoginInput {
    pub provider: ProviderKind,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InspectProviderAccountStatusInput {
    pub provider: ProviderKind,
    pub profile_id: Option<String>,
}

fn default_profile_auth_kind() -> ProfileAuthKind {
    ProfileAuthKind::ApiKey
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssignPaneProfileInput {
    pub pane_id: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssignPaneProviderInput {
    pub pane_id: String,
    pub provider: ProviderKind,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ComposerStreamEvent {
    pub pane_id: String,
    pub session_id: String,
    pub message_id: String,
    pub stage: ComposerStreamStage,
    pub kind: ComposerStreamEventKind,
    pub role: MessageRole,
    pub chunk: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ComposerStreamStage {
    Started,
    Delta,
    Finished,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ComposerStreamEventKind {
    Message,
    Status,
    ToolCall,
    ToolResult,
    Error,
}
