use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex, MutexGuard},
    thread,
};

use crate::models::{
    AssignPaneProfileInput, CancelPaneRunInput, ComposerStreamEvent, ComposerStreamStage,
    CreateProjectInput, CreateSessionInput, DashboardState, DeleteProviderProfileInput,
    DeleteSessionInput, LaunchProviderLoginInput, OpenPaneInput, PaneRecord, PaneTarget,
    ProfileAuthKind, ProjectRecord, ProviderAuthLaunchResult, ProviderConnectionTestResult,
    ProviderProfileRecord, RemoteStatus, ReplacePaneSessionInput, SaveProviderProfileInput,
    SendComposerMessageInput, SendComposerMessageResult, SessionRecord, SetWorkspaceLayoutInput,
    TestProviderProfileInput, ToggleRemoteTunnelInput, WorkspaceSummary,
};
use crate::providers::{
    execute_message, launch_provider_login, probe_provider_health, stream_message,
    test_provider_connection, ProviderRuntimeConfig,
};
use crate::secret_store::SecretStore;
use crate::storage::Storage;
use crate::store::{MessageDispatch, Store};
use tauri::{AppHandle, Emitter};

#[derive(Clone)]
pub struct AppState {
    inner: Arc<Mutex<Store>>,
    storage: Storage,
    secrets: SecretStore,
    active_runs: Arc<Mutex<HashMap<String, u32>>>,
    canceled_runs: Arc<Mutex<HashSet<String>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self::from_storage(Storage::default())
    }

    #[cfg(test)]
    pub fn new_for_path(path: std::path::PathBuf) -> Self {
        Self::from_storage(Storage::new(path))
    }

    fn from_storage(storage: Storage) -> Self {
        let mut store = storage
            .load_or_seed()
            .unwrap_or_else(|error| panic!("failed to initialize application state: {error}"));
        store.remote_status.provider_health = probe_provider_health();

        Self {
            inner: Arc::new(Mutex::new(store)),
            storage,
            secrets: SecretStore::new(),
            active_runs: Arc::new(Mutex::new(HashMap::new())),
            canceled_runs: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn dashboard_state(&self) -> Result<DashboardState, String> {
        let store = self.lock()?;
        Ok(store.dashboard_state())
    }

    pub fn create_project(&self, input: CreateProjectInput) -> Result<ProjectRecord, String> {
        self.mutate(|store| store.create_project(input))
    }

    pub fn delete_project(
        &self,
        input: crate::models::DeleteProjectInput,
    ) -> Result<ProjectRecord, String> {
        self.mutate(|store| store.delete_project(input))
    }

    pub fn create_session(&self, input: CreateSessionInput) -> Result<SessionRecord, String> {
        self.mutate(|store| store.create_session(input))
    }

    pub fn delete_session(&self, input: DeleteSessionInput) -> Result<SessionRecord, String> {
        self.mutate(|store| store.delete_session(input))
    }

    pub fn save_provider_profile(
        &self,
        input: SaveProviderProfileInput,
    ) -> Result<ProviderProfileRecord, String> {
        let is_new = input.id.is_none();
        let has_api_key = !input.api_key.trim().is_empty();
        let auth_kind = input.auth_kind.clone().unwrap_or(ProfileAuthKind::ApiKey);
        if is_new && auth_kind == ProfileAuthKind::ApiKey && !has_api_key {
            return Err("api key is required when creating a profile".into());
        }

        let profile = self.mutate(|store| store.save_provider_profile(input.clone()))?;
        if auth_kind == ProfileAuthKind::System {
            let _ = self.secrets.delete_profile_api_key(&profile.id);
        } else if has_api_key {
            self.secrets
                .set_profile_api_key(&profile.id, &input.api_key)?;
        }
        Ok(profile)
    }

    pub fn delete_provider_profile(
        &self,
        input: DeleteProviderProfileInput,
    ) -> Result<ProviderProfileRecord, String> {
        let profile = self.mutate(|store| store.delete_provider_profile(input.clone()))?;
        self.secrets.delete_profile_api_key(&input.profile_id)?;
        Ok(profile)
    }

    pub fn assign_pane_profile(&self, input: AssignPaneProfileInput) -> Result<PaneRecord, String> {
        self.mutate(|store| store.assign_pane_profile(input))
    }

    pub fn launch_provider_login(
        &self,
        input: LaunchProviderLoginInput,
    ) -> Result<ProviderAuthLaunchResult, String> {
        let result = launch_provider_login(&input.provider)?;
        self.refresh_provider_health()?;
        Ok(result)
    }

    pub fn test_provider_profile(
        &self,
        input: TestProviderProfileInput,
    ) -> Result<ProviderConnectionTestResult, String> {
        let mut auth_kind = input.auth_kind.clone().unwrap_or(ProfileAuthKind::ApiKey);
        let trimmed_profile_id = clean_optional_string(&input.profile_id.unwrap_or_default());
        let trimmed_label = clean_optional_string(&input.label.unwrap_or_default());
        let trimmed_base_url = clean_optional_string(&input.base_url);
        let trimmed_api_key = clean_optional_string(&input.api_key);
        let trimmed_model = clean_optional_string(&input.model.unwrap_or_default());

        let mut profile_label = trimmed_label;
        let mut base_url = trimmed_base_url;
        let mut api_key = trimmed_api_key;
        let mut model = trimmed_model;

        if let Some(profile_id) = trimmed_profile_id.clone() {
            let store = self.lock()?;
            let profile = store
                .provider_profiles
                .iter()
                .find(|profile| profile.id == profile_id)
                .cloned()
                .ok_or_else(|| "profile not found".to_string())?;
            drop(store);

            if profile.provider != input.provider {
                return Err("profile provider does not match requested provider".into());
            }
            auth_kind = profile.auth_kind.clone();

            if profile_label.is_none() {
                profile_label = Some(profile.label);
            }
            if base_url.is_none() {
                base_url = clean_optional_string(&profile.base_url);
            }
            if model.is_none() {
                model = profile.model;
            }
            if api_key.is_none() && profile.auth_kind != ProfileAuthKind::System {
                api_key = self.secrets.get_profile_api_key(&profile.id)?;
            }
        }

        Ok(test_provider_connection(ProviderRuntimeConfig {
            provider: &input.provider,
            profile_id: trimmed_profile_id.as_deref(),
            profile_label: profile_label.as_deref(),
            base_url: base_url.as_deref(),
            api_key: if auth_kind == ProfileAuthKind::System {
                None
            } else {
                api_key.as_deref()
            },
            model: model.as_deref(),
        }))
    }

    pub fn open_pane(&self, input: OpenPaneInput) -> Result<PaneRecord, String> {
        self.mutate(|store| store.open_pane(input))
    }

    pub fn replace_pane_session(&self, input: ReplacePaneSessionInput) -> Result<PaneRecord, String> {
        self.mutate(|store| store.replace_pane_session(input))
    }

    pub fn close_pane(&self, target: PaneTarget) -> Result<PaneRecord, String> {
        self.mutate(|store| store.close_pane(target))
    }

    pub fn focus_pane(&self, target: PaneTarget) -> Result<PaneRecord, String> {
        self.mutate(|store| store.focus_pane(target))
    }

    pub fn send_composer_message(
        &self,
        input: SendComposerMessageInput,
    ) -> Result<SendComposerMessageResult, String> {
        let dispatch =
            self.resolve_dispatch(self.mutate(|store| store.begin_composer_message(input))?)?;
        let completion = execute_message(&dispatch);
        self.mutate(|store| store.complete_composer_message(completion))
    }

    pub fn cancel_pane_run(&self, input: CancelPaneRunInput) -> Result<(), String> {
        self.mark_run_canceled(&input.pane_id)?;
        let pid = {
            let active_runs = self
                .active_runs
                .lock()
                .map_err(|_| "active run lock poisoned".to_string())?;
            active_runs.get(&input.pane_id).copied()
        };

        if let Some(pid) = pid {
            kill_process(pid)?;
        } else {
            self.clear_run_canceled(&input.pane_id)?;
            return Err("no active run found for pane".into());
        }

        Ok(())
    }

    pub fn start_composer_stream(
        &self,
        app: AppHandle,
        input: SendComposerMessageInput,
    ) -> Result<(), String> {
        let dispatch =
            self.resolve_dispatch(self.mutate(|store| store.begin_composer_message(input))?)?;
        let app_state = self.clone();

        thread::spawn(move || {
            let stream_message_id = format!("stream-{}", dispatch.session_id);
            let _ = app.emit(
                "composer://stream",
                ComposerStreamEvent {
                    pane_id: dispatch.pane_id.clone(),
                    session_id: dispatch.session_id.clone(),
                    message_id: stream_message_id.clone(),
                    stage: ComposerStreamStage::Started,
                    role: crate::models::MessageRole::Assistant,
                    chunk: None,
                },
            );

            let completion = stream_message(
                &dispatch,
                |role, chunk| {
                    let _ = app.emit(
                        "composer://stream",
                        ComposerStreamEvent {
                            pane_id: dispatch.pane_id.clone(),
                            session_id: dispatch.session_id.clone(),
                            message_id: stream_message_id.clone(),
                            stage: ComposerStreamStage::Delta,
                            role,
                            chunk: Some(chunk.to_string()),
                        },
                    );
                },
                |pid| {
                    let _ = app_state.track_active_run(&dispatch.pane_id, pid);
                },
            );

            let completion = if app_state
                .is_run_canceled(&dispatch.pane_id)
                .unwrap_or(false)
            {
                app_state.clear_run_canceled(&dispatch.pane_id).ok();
                canceled_completion(&dispatch.session_id)
            } else {
                completion
            };
            app_state.finish_active_run(&dispatch.pane_id).ok();

            match app_state.mutate(|store| store.complete_composer_message(completion.clone())) {
                Ok(_) => {
                    let _ = app.emit(
                        "composer://stream",
                        ComposerStreamEvent {
                            pane_id: dispatch.pane_id.clone(),
                            session_id: completion.session_id,
                            message_id: stream_message_id,
                            stage: ComposerStreamStage::Finished,
                            role: completion.assistant_role,
                            chunk: None,
                        },
                    );
                }
                Err(error) => {
                    let _ = app.emit(
                        "composer://stream",
                        ComposerStreamEvent {
                            pane_id: dispatch.pane_id,
                            session_id: dispatch.session_id,
                            message_id: stream_message_id,
                            stage: ComposerStreamStage::Failed,
                            role: crate::models::MessageRole::System,
                            chunk: Some(error),
                        },
                    );
                }
            }
        });

        Ok(())
    }

    pub fn remote_status(&self) -> Result<RemoteStatus, String> {
        let store = self.lock()?;
        Ok(store.remote_status())
    }

    pub fn set_workspace_layout(
        &self,
        input: SetWorkspaceLayoutInput,
    ) -> Result<WorkspaceSummary, String> {
        self.mutate(|store| store.set_workspace_layout(input))
    }

    pub fn toggle_remote_tunnel(
        &self,
        input: ToggleRemoteTunnelInput,
    ) -> Result<RemoteStatus, String> {
        self.mutate(|store| store.toggle_remote_tunnel(input))
    }

    pub fn refresh_provider_health(&self) -> Result<(), String> {
        self.mutate(|store| {
            store.remote_status.provider_health = probe_provider_health();
            Ok(())
        })
    }

    fn mutate<T>(&self, apply: impl FnOnce(&mut Store) -> Result<T, String>) -> Result<T, String> {
        let mut store = self.lock()?;
        let snapshot = store.clone();
        let result = apply(&mut store)?;

        if let Err(error) = self.storage.save(&store) {
            *store = snapshot;
            return Err(error);
        }

        Ok(result)
    }

    fn lock(&self) -> Result<MutexGuard<'_, Store>, String> {
        self.inner
            .lock()
            .map_err(|_| "application state lock poisoned".to_string())
    }

    fn track_active_run(&self, pane_id: &str, pid: u32) -> Result<(), String> {
        let mut active_runs = self
            .active_runs
            .lock()
            .map_err(|_| "active run lock poisoned".to_string())?;
        active_runs.insert(pane_id.to_string(), pid);
        Ok(())
    }

    fn finish_active_run(&self, pane_id: &str) -> Result<(), String> {
        let mut active_runs = self
            .active_runs
            .lock()
            .map_err(|_| "active run lock poisoned".to_string())?;
        active_runs.remove(pane_id);
        Ok(())
    }

    fn mark_run_canceled(&self, pane_id: &str) -> Result<(), String> {
        let mut canceled_runs = self
            .canceled_runs
            .lock()
            .map_err(|_| "canceled run lock poisoned".to_string())?;
        canceled_runs.insert(pane_id.to_string());
        Ok(())
    }

    fn clear_run_canceled(&self, pane_id: &str) -> Result<(), String> {
        let mut canceled_runs = self
            .canceled_runs
            .lock()
            .map_err(|_| "canceled run lock poisoned".to_string())?;
        canceled_runs.remove(pane_id);
        Ok(())
    }

    fn is_run_canceled(&self, pane_id: &str) -> Result<bool, String> {
        let canceled_runs = self
            .canceled_runs
            .lock()
            .map_err(|_| "canceled run lock poisoned".to_string())?;
        Ok(canceled_runs.contains(pane_id))
    }

    fn resolve_dispatch(&self, mut dispatch: MessageDispatch) -> Result<MessageDispatch, String> {
        if cfg!(test) || std::env::var("CC_COPILOT_NEXT_DISABLE_PROVIDERS").as_deref() == Ok("1") {
            return Ok(dispatch);
        }

        let Some(profile_id) = dispatch.profile_id.clone() else {
            return Ok(dispatch);
        };

        let store = self.lock()?;
        let profile = store
            .provider_profiles
            .iter()
            .find(|profile| profile.id == profile_id)
            .cloned()
            .ok_or_else(|| "profile not found".to_string())?;
        drop(store);

        if profile.provider != dispatch.provider {
            return Err("profile provider does not match pane provider".into());
        }

        dispatch.profile_label = Some(profile.label);
        dispatch.base_url = clean_optional_string(&profile.base_url);
        dispatch.model = profile.model;
        if profile.auth_kind == ProfileAuthKind::ApiKey {
            let api_key = self
                .secrets
                .get_profile_api_key(&profile.id)?
                .ok_or_else(|| {
                    format!(
                        "api key missing for profile {}",
                        dispatch
                            .profile_label
                            .clone()
                            .unwrap_or_else(|| "profile".into())
                    )
                })?;
            dispatch.api_key = Some(api_key);
        }
        Ok(dispatch)
    }
}

fn canceled_completion(session_id: &str) -> crate::store::MessageCompletion {
    crate::store::MessageCompletion {
        session_id: session_id.to_string(),
        provider_session_id: None,
        assistant_role: crate::models::MessageRole::System,
        assistant_content: "Run canceled by user.".into(),
        session_status: crate::models::SessionStatus::Idle,
        provider_status: crate::models::ConnectionState::Degraded,
        provider_latency_ms: 0,
        provider_note: "Run canceled by user.".into(),
    }
}

fn kill_process(pid: u32) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        let status = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .map_err(|error| format!("failed to terminate process {pid}: {error}"))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("failed to terminate process {pid}"));
    }

    let status = std::process::Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .map_err(|error| format!("failed to terminate process {pid}: {error}"))?;
    if status.success() {
        return Ok(());
    }

    Err(format!("failed to terminate process {pid}"))
}

fn clean_optional_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use tempfile::tempdir;

    use super::AppState;
    use crate::models::{
        CreateProjectInput, CreateSessionInput, MessageRole, OpenPaneInput, PaneKind, PaneTarget,
        ReplacePaneSessionInput, SendComposerMessageInput, SetWorkspaceLayoutInput,
        ToggleRemoteTunnelInput, DeleteSessionInput,
    };

    #[test]
    fn creates_project_and_session() {
        let dir = tempdir().expect("temp dir should exist");
        let state = AppState::new_for_path(dir.path().join("dashboard-state.json"));
        let project = state
            .create_project(CreateProjectInput {
                name: "sandbox".into(),
                path: "/tmp/sandbox".into(),
            })
            .expect("project should be created");
        let session = state
            .create_session(CreateSessionInput {
                project_id: project.id.clone(),
                title: "First prompt".into(),
                provider: None,
                profile_id: None,
            })
            .expect("session should be created");

        assert_eq!(session.project_id, project.id);

        let dashboard = state.dashboard_state().expect("dashboard should load");
        assert!(dashboard.projects.iter().any(|item| item.id == project.id));
        assert!(dashboard.sessions.iter().any(|item| item.id == session.id));
    }

    #[test]
    fn focuses_newly_opened_pane() {
        let dir = tempdir().expect("temp dir should exist");
        let state = create_workspace_with_two_sessions(dir.path());
        let session_id = {
            let dashboard = state.dashboard_state().expect("dashboard should load");
            dashboard.sessions[0].id.clone()
        };
        let pane = state
            .open_pane(OpenPaneInput {
                session_id: session_id.clone(),
                title: "Preview".into(),
                kind: PaneKind::Preview,
                profile_id: None,
                focus: Some(true),
            })
            .expect("pane should open");

        let dashboard = state.dashboard_state().expect("dashboard should load");
        assert!(dashboard
            .panes
            .iter()
            .any(|candidate| candidate.id == pane.id && candidate.is_focused));
        assert_eq!(dashboard.active_session_id.as_deref(), Some(session_id.as_str()));
    }

    #[test]
    fn closing_focused_pane_promotes_fallback() {
        let dir = tempdir().expect("temp dir should exist");
        let state = create_workspace_with_two_sessions(dir.path());
        let (source_session_id, source_pane_id) = {
            let dashboard = state.dashboard_state().expect("dashboard should load");
            (
                dashboard.sessions[0].id.clone(),
                dashboard.panes[0].id.clone(),
            )
        };
        let pane = state
            .open_pane(OpenPaneInput {
                session_id: source_session_id,
                title: "Preview".into(),
                kind: PaneKind::Preview,
                profile_id: None,
                focus: Some(true),
            })
            .expect("second pane should open");
        state
            .close_pane(PaneTarget { pane_id: pane.id })
            .expect("pane should close");

        let dashboard = state.dashboard_state().expect("dashboard should load");
        assert!(dashboard
            .panes
            .iter()
            .any(|pane| pane.id == source_pane_id && pane.is_focused));
    }

    #[test]
    fn replacing_pane_session_keeps_layout_and_focuses_target_session() {
        let dir = tempdir().expect("temp dir should exist");
        let state = create_workspace_with_two_sessions(dir.path());
        let (pane_id, replacement_session_id) = {
            let dashboard = state.dashboard_state().expect("dashboard should load");
            (
                dashboard.panes[0].id.clone(),
                dashboard.sessions[1].id.clone(),
            )
        };
        state
            .replace_pane_session(ReplacePaneSessionInput {
                pane_id: pane_id.clone(),
                session_id: replacement_session_id.clone(),
                title: "Streaming composer polish".into(),
                profile_id: None,
                focus: Some(true),
            })
            .expect("pane should be replaced");

        let dashboard = state.dashboard_state().expect("dashboard should load");
        let pane = dashboard
            .panes
            .iter()
            .find(|pane| pane.id == pane_id)
            .expect("pane should exist");
        assert_eq!(pane.session_id, replacement_session_id);
        assert!(pane.is_focused);
        assert_eq!(dashboard.active_session_id.as_deref(), Some(pane.session_id.as_str()));
    }

    #[test]
    fn deleting_session_removes_related_panes_and_messages() {
        let dir = tempdir().expect("temp dir should exist");
        let state = create_workspace_with_two_sessions(dir.path());
        let (project_id, session_id) = {
            let dashboard = state.dashboard_state().expect("dashboard should load");
            (
                dashboard.projects[0].id.clone(),
                dashboard.sessions[1].id.clone(),
            )
        };
        state
            .open_pane(OpenPaneInput {
                session_id: session_id.clone(),
                title: "Streaming composer polish".into(),
                kind: PaneKind::Chat,
                profile_id: None,
                focus: Some(false),
            })
            .expect("pane should open");

        state
            .delete_session(DeleteSessionInput {
                project_id,
                session_id: session_id.clone(),
            })
            .expect("session should delete");

        let dashboard = state.dashboard_state().expect("dashboard should load");
        assert!(!dashboard.sessions.iter().any(|session| session.id == session_id));
        assert!(!dashboard
            .panes
            .iter()
            .any(|pane| pane.session_id == session_id && pane.status == crate::models::PaneStatus::Open));
        assert!(!dashboard.messages.iter().any(|message| message.session_id == session_id));
    }

    #[test]
    fn sending_message_updates_session_and_persists_conversation() {
        let dir = tempdir().expect("temp dir should exist");
        let path = dir.path().join("dashboard-state.json");
        let state = create_workspace_with_two_sessions(dir.path());
        let (pane_id, session_id) = {
            let dashboard = state.dashboard_state().expect("dashboard should load");
            (
                dashboard.panes[0].id.clone(),
                dashboard.sessions[0].id.clone(),
            )
        };
        let result = state
            .send_composer_message(SendComposerMessageInput {
                pane_id,
                content: "Need a remote status card in the dashboard".into(),
            })
            .expect("message should send");

        assert_eq!(result.message.session_id, session_id);
        assert!(matches!(
            result.assistant_message.role,
            MessageRole::Assistant | MessageRole::System
        ));
        assert!(!result.draft.is_streaming);
        assert!(!result.session.last_message_preview.is_empty());

        let reloaded = AppState::new_for_path(path);
        let dashboard = reloaded.dashboard_state().expect("dashboard should reload");
        let persisted_messages: Vec<_> = dashboard
            .messages
            .iter()
            .filter(|message| message.session_id == result.message.session_id)
            .collect();
        assert!(persisted_messages.len() >= 2);
        assert_eq!(
            persisted_messages[persisted_messages.len() - 2].role,
            MessageRole::User
        );
        assert!(matches!(
            persisted_messages[persisted_messages.len() - 1].role,
            MessageRole::Assistant | MessageRole::System
        ));
    }

    #[test]
    fn workspace_layout_and_remote_toggle_are_mutable() {
        let dir = tempdir().expect("temp dir should exist");
        let state = AppState::new_for_path(dir.path().join("dashboard-state.json"));
        let workspace = state
            .set_workspace_layout(SetWorkspaceLayoutInput {
                layout_mode: "grid".into(),
            })
            .expect("layout should update");
        let remote = state
            .toggle_remote_tunnel(ToggleRemoteTunnelInput { enabled: false })
            .expect("remote tunnel should toggle");

        assert_eq!(workspace.layout_mode, "grid");
        assert!(!remote.frp.enabled);
        assert_eq!(remote.frp.active_tunnels, 0);
    }

    fn create_workspace_with_two_sessions(root: &Path) -> AppState {
        let path = root.join("dashboard-state.json");
        let state = AppState::new_for_path(path);
        let project = state
            .create_project(CreateProjectInput {
                name: "sandbox".into(),
                path: "/tmp/sandbox".into(),
            })
            .expect("project should be created");
        let session_a = state
            .create_session(CreateSessionInput {
                project_id: project.id.clone(),
                title: "Session A".into(),
                provider: None,
                profile_id: None,
            })
            .expect("session A should be created");
        let _session_b = state
            .create_session(CreateSessionInput {
                project_id: project.id,
                title: "Session B".into(),
                provider: None,
                profile_id: None,
            })
            .expect("session B should be created");
        state
            .open_pane(OpenPaneInput {
                session_id: session_a.id,
                title: "Main chat".into(),
                kind: PaneKind::Chat,
                profile_id: None,
                focus: Some(true),
            })
            .expect("default pane should open");
        state
    }
}
