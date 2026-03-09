use tauri::AppHandle;
use tauri::State;

use crate::{
    models::{
        AssignPaneProfileInput, AssignPaneProviderInput, CancelPaneRunInput, CreateProjectInput,
        CreateSessionInput, DashboardState, DeleteProviderProfileInput, DeleteSessionInput,
        GetProviderAccountStatusInput, InspectProviderAccountStatusInput, LaunchProviderLoginInput,
        OpenPaneInput, PaneRecord, PaneTarget, ProjectRecord, ProviderAccountStatus,
        ProviderAuthLaunchResult, ProviderConnectionTestResult, ProviderProfileRecord,
        RemoteStatus, ReplacePaneSessionInput, RetryComposerMessageInput, SaveProviderProfileInput,
        SendComposerMessageInput, SendComposerMessageResult, SessionRecord,
        SetWorkspaceLayoutInput, SkillSummary, TestProviderProfileInput, ToggleRemoteTunnelInput,
        WorkspaceSummary,
    },
    state::AppState,
};

#[tauri::command]
pub fn get_dashboard_state(state: State<'_, AppState>) -> Result<DashboardState, String> {
    state.dashboard_state()
}

#[tauri::command]
pub fn get_provider_account_status(
    state: State<'_, AppState>,
    input: GetProviderAccountStatusInput,
) -> Result<ProviderAccountStatus, String> {
    state.get_provider_account_status(input)
}

#[tauri::command]
pub fn inspect_provider_account_status(
    state: State<'_, AppState>,
    input: InspectProviderAccountStatusInput,
) -> Result<ProviderAccountStatus, String> {
    state.inspect_provider_account_status(input)
}

#[tauri::command]
pub fn get_available_skills(state: State<'_, AppState>) -> Result<Vec<SkillSummary>, String> {
    state.get_available_skills()
}

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<ProjectRecord, String> {
    state.create_project(input)
}

#[tauri::command]
pub fn delete_project(
    state: State<'_, AppState>,
    input: crate::models::DeleteProjectInput,
) -> Result<ProjectRecord, String> {
    state.delete_project(input)
}

#[tauri::command]
pub fn create_session(
    state: State<'_, AppState>,
    input: CreateSessionInput,
) -> Result<SessionRecord, String> {
    state.create_session(input)
}

#[tauri::command]
pub fn delete_session(
    state: State<'_, AppState>,
    input: DeleteSessionInput,
) -> Result<SessionRecord, String> {
    state.delete_session(input)
}

#[tauri::command]
pub fn save_provider_profile(
    state: State<'_, AppState>,
    input: SaveProviderProfileInput,
) -> Result<ProviderProfileRecord, String> {
    state.save_provider_profile(input)
}

#[tauri::command]
pub fn delete_provider_profile(
    state: State<'_, AppState>,
    input: DeleteProviderProfileInput,
) -> Result<ProviderProfileRecord, String> {
    state.delete_provider_profile(input)
}

#[tauri::command]
pub fn assign_pane_profile(
    state: State<'_, AppState>,
    input: AssignPaneProfileInput,
) -> Result<PaneRecord, String> {
    state.assign_pane_profile(input)
}

#[tauri::command]
pub fn assign_pane_provider(
    state: State<'_, AppState>,
    input: AssignPaneProviderInput,
) -> Result<PaneRecord, String> {
    state.assign_pane_provider(input)
}

#[tauri::command]
pub async fn test_provider_profile(
    state: State<'_, AppState>,
    input: TestProviderProfileInput,
) -> Result<ProviderConnectionTestResult, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || app_state.test_provider_profile(input))
        .await
        .map_err(|error| format!("failed to join provider test task: {error}"))?
}

#[tauri::command]
pub fn launch_provider_login(
    state: State<'_, AppState>,
    input: LaunchProviderLoginInput,
) -> Result<ProviderAuthLaunchResult, String> {
    state.launch_provider_login(input)
}

#[tauri::command]
pub fn open_pane(state: State<'_, AppState>, input: OpenPaneInput) -> Result<PaneRecord, String> {
    state.open_pane(input)
}

#[tauri::command]
pub fn replace_pane_session(
    state: State<'_, AppState>,
    input: ReplacePaneSessionInput,
) -> Result<PaneRecord, String> {
    state.replace_pane_session(input)
}

#[tauri::command]
pub fn close_pane(state: State<'_, AppState>, target: PaneTarget) -> Result<PaneRecord, String> {
    state.close_pane(target)
}

#[tauri::command]
pub fn focus_pane(state: State<'_, AppState>, target: PaneTarget) -> Result<PaneRecord, String> {
    state.focus_pane(target)
}

#[tauri::command]
pub fn send_composer_message(
    state: State<'_, AppState>,
    input: SendComposerMessageInput,
) -> Result<SendComposerMessageResult, String> {
    state.send_composer_message(input)
}

#[tauri::command]
pub fn start_composer_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SendComposerMessageInput,
) -> Result<(), String> {
    state.start_composer_stream(app, input)
}

#[tauri::command]
pub fn retry_composer_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    input: RetryComposerMessageInput,
) -> Result<(), String> {
    state.retry_composer_stream(app, input)
}

#[tauri::command]
pub fn cancel_pane_run(
    state: State<'_, AppState>,
    input: CancelPaneRunInput,
) -> Result<(), String> {
    state.cancel_pane_run(input)
}

#[tauri::command]
pub fn get_remote_status(state: State<'_, AppState>) -> Result<RemoteStatus, String> {
    state.remote_status()
}

#[tauri::command]
pub fn set_workspace_layout(
    state: State<'_, AppState>,
    input: SetWorkspaceLayoutInput,
) -> Result<WorkspaceSummary, String> {
    state.set_workspace_layout(input)
}

#[tauri::command]
pub fn toggle_remote_tunnel(
    state: State<'_, AppState>,
    input: ToggleRemoteTunnelInput,
) -> Result<RemoteStatus, String> {
    state.toggle_remote_tunnel(input)
}
