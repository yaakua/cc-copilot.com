use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::models::{
    AssignPaneProfileInput, ComposerDraft, ComposerMessage, ConnectionState, CreateProjectInput,
    CreateSessionInput, DashboardState, DeleteProviderProfileInput, MessageRole, OpenPaneInput,
    PaneRecord, PaneStatus, PaneTarget, ProfileAuthKind, ProjectRecord, ProviderKind,
    ProviderProfileRecord, RemoteStatus, SaveProviderProfileInput, SendComposerMessageInput,
    SendComposerMessageResult, SessionRecord, SessionStatus, SetWorkspaceLayoutInput,
    ToggleRemoteTunnelInput, WorkspaceSummary,
};

#[derive(Debug, Clone)]
pub struct MessageDispatch {
    pub pane_id: String,
    pub session_id: String,
    pub project_path: String,
    pub provider: ProviderKind,
    pub profile_id: Option<String>,
    pub profile_label: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub user_message: ComposerMessage,
}

#[derive(Debug, Clone)]
pub struct MessageCompletion {
    pub session_id: String,
    pub assistant_role: MessageRole,
    pub assistant_content: String,
    pub session_status: SessionStatus,
    pub provider_status: ConnectionState,
    pub provider_latency_ms: u32,
    pub provider_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Store {
    pub workspace: WorkspaceSummary,
    pub projects: Vec<ProjectRecord>,
    #[serde(default)]
    pub provider_profiles: Vec<ProviderProfileRecord>,
    pub sessions: Vec<SessionRecord>,
    pub panes: Vec<PaneRecord>,
    pub drafts: Vec<ComposerDraft>,
    pub messages: Vec<ComposerMessage>,
    pub remote_status: RemoteStatus,
    pub next_id: u64,
    pub active_project_id: Option<String>,
    pub active_session_id: Option<String>,
}

impl Store {
    pub fn dashboard_state(&self) -> DashboardState {
        DashboardState {
            workspace: self.workspace.clone(),
            projects: self.projects.clone(),
            remote: self.remote_status.clone(),
            providers: self.remote_status.provider_health.clone(),
            provider_profiles: self.provider_profiles.clone(),
            sessions: self.sessions.clone(),
            panes: self.panes.clone(),
            messages: self.messages.clone(),
            active_project_id: self.active_project_id.clone(),
            active_session_id: self.active_session_id.clone(),
            composer_drafts: self.drafts.clone(),
        }
    }

    pub fn create_project(&mut self, input: CreateProjectInput) -> Result<ProjectRecord, String> {
        let name = input.name.trim();
        let path = input.path.trim();
        if name.is_empty() {
            return Err("project name cannot be empty".into());
        }
        if path.is_empty() {
            return Err("project path cannot be empty".into());
        }
        if self.projects.iter().any(|project| project.path == path) {
            return Err("project path already exists".into());
        }

        let now = now_ms();
        let project = ProjectRecord {
            id: self.next_id("project"),
            name: name.into(),
            path: path.into(),
            session_ids: Vec::new(),
            created_at: now,
            updated_at: now,
        };
        self.active_project_id = Some(project.id.clone());
        self.projects.push(project.clone());
        Ok(project)
    }

    pub fn create_session(&mut self, input: CreateSessionInput) -> Result<SessionRecord, String> {
        let now = now_ms();
        let provider = input.provider.unwrap_or(ProviderKind::Mock);
        let title = input.title.trim();
        if title.is_empty() {
            return Err("session title cannot be empty".into());
        }

        let project_index = self
            .projects
            .iter()
            .position(|project| project.id == input.project_id)
            .ok_or_else(|| "project not found".to_string())?;
        let project_id = self.projects[project_index].id.clone();
        let session_id = self.next_id("session");

        let session = SessionRecord {
            id: session_id.clone(),
            project_id: project_id.clone(),
            title: title.into(),
            provider,
            profile_id: input.profile_id,
            status: SessionStatus::Idle,
            last_message_preview: "New workspace session".into(),
            created_at: now,
            updated_at: now,
        };

        self.projects[project_index].session_ids.push(session_id);
        self.projects[project_index].updated_at = now;
        self.active_project_id = Some(project_id);
        self.active_session_id = Some(session.id.clone());
        self.drafts.push(ComposerDraft {
            session_id: session.id.clone(),
            text: String::new(),
            is_streaming: false,
            updated_at: now,
        });
        self.sessions.push(session.clone());
        Ok(session)
    }

    pub fn open_pane(&mut self, input: OpenPaneInput) -> Result<PaneRecord, String> {
        let open_pane_count = self
            .panes
            .iter()
            .filter(|pane| pane.status == PaneStatus::Open)
            .count();
        if open_pane_count >= 4 {
            return Err("maximum of 4 open panes reached".into());
        }

        let title = input.title.trim();
        if title.is_empty() {
            return Err("pane title cannot be empty".into());
        }

        let session_index = self
            .sessions
            .iter()
            .position(|session| session.id == input.session_id)
            .ok_or_else(|| "session not found".to_string())?;
        let session_id = self.sessions[session_index].id.clone();
        let now = now_ms();
        let should_focus = input.focus.unwrap_or(true);
        if should_focus {
            for pane in &mut self.panes {
                pane.is_focused = false;
            }
        }

        let pane = PaneRecord {
            id: self.next_id("pane"),
            session_id: session_id.clone(),
            title: title.to_string(),
            kind: input.kind,
            profile_id: input
                .profile_id
                .or_else(|| self.sessions[session_index].profile_id.clone()),
            status: PaneStatus::Open,
            is_focused: should_focus,
            created_at: now,
            updated_at: now,
        };
        self.sessions[session_index].updated_at = now;
        self.active_session_id = Some(session_id);
        self.panes.push(pane.clone());
        self.workspace.layout_mode = match open_pane_count + 1 {
            1 => "single".into(),
            2 => "dual".into(),
            3 => "triple".into(),
            _ => "quad".into(),
        };
        Ok(pane)
    }

    pub fn close_pane(&mut self, target: PaneTarget) -> Result<PaneRecord, String> {
        let now = now_ms();
        let pane_index = self
            .panes
            .iter()
            .position(|pane| pane.id == target.pane_id)
            .ok_or_else(|| "pane not found".to_string())?;
        let closed_pane_id = self.panes[pane_index].id.clone();
        let closed_session_id = self.panes[pane_index].session_id.clone();
        let was_focused = self.panes[pane_index].is_focused;

        self.panes[pane_index].status = PaneStatus::Closed;
        self.panes[pane_index].is_focused = false;
        self.panes[pane_index].updated_at = now;

        if was_focused {
            let fallback_index = self
                .panes
                .iter()
                .position(|candidate| {
                    candidate.status == PaneStatus::Open
                        && candidate.id != closed_pane_id
                        && candidate.session_id == closed_session_id
                })
                .or_else(|| {
                    self.panes.iter().rposition(|candidate| {
                        candidate.status == PaneStatus::Open && candidate.id != closed_pane_id
                    })
                });

            if let Some(fallback_index) = fallback_index {
                self.panes[fallback_index].is_focused = true;
                self.panes[fallback_index].updated_at = now;
                self.active_session_id = Some(self.panes[fallback_index].session_id.clone());
            } else {
                self.active_session_id = None;
            }
        }

        let open_pane_count = self
            .panes
            .iter()
            .filter(|pane| pane.status == PaneStatus::Open)
            .count();
        self.workspace.layout_mode = match open_pane_count {
            0 | 1 => "single".into(),
            2 => "dual".into(),
            3 => "triple".into(),
            _ => "quad".into(),
        };

        Ok(self.panes[pane_index].clone())
    }

    pub fn focus_pane(&mut self, target: PaneTarget) -> Result<PaneRecord, String> {
        let now = now_ms();
        let pane_index = self
            .panes
            .iter()
            .position(|pane| pane.id == target.pane_id)
            .ok_or_else(|| "pane not found".to_string())?;

        if self.panes[pane_index].status == PaneStatus::Closed {
            return Err("cannot focus a closed pane".into());
        }

        for pane in &mut self.panes {
            pane.is_focused = false;
        }
        let pane = &mut self.panes[pane_index];
        pane.is_focused = true;
        pane.updated_at = now;
        self.active_session_id = Some(pane.session_id.clone());
        Ok(pane.clone())
    }

    pub fn save_provider_profile(
        &mut self,
        input: SaveProviderProfileInput,
    ) -> Result<ProviderProfileRecord, String> {
        let label = input.label.trim();
        if label.is_empty() {
            return Err("profile label cannot be empty".into());
        }

        let now = now_ms();
        let auth_kind = input.auth_kind.clone().unwrap_or(ProfileAuthKind::ApiKey);
        if let Some(profile_id) = input.id {
            let profile = self
                .provider_profiles
                .iter_mut()
                .find(|profile| profile.id == profile_id)
                .ok_or_else(|| "profile not found".to_string())?;
            profile.provider = input.provider;
            profile.label = label.to_string();
            profile.auth_kind = auth_kind.clone();
            profile.base_url = input.base_url.trim().to_string();
            profile.model = clean_optional(input.model);
            profile.api_key_present = if profile.auth_kind == ProfileAuthKind::System {
                false
            } else {
                profile.api_key_present || !input.api_key.trim().is_empty()
            };
            profile.updated_at = now;
            return Ok(profile.clone());
        }

        let profile = ProviderProfileRecord {
            id: self.next_id("profile"),
            provider: input.provider,
            label: label.to_string(),
            auth_kind: auth_kind.clone(),
            base_url: input.base_url.trim().to_string(),
            model: clean_optional(input.model),
            api_key_present: auth_kind != ProfileAuthKind::System
                && !input.api_key.trim().is_empty(),
            created_at: now,
            updated_at: now,
        };
        self.provider_profiles.push(profile.clone());
        Ok(profile)
    }

    pub fn delete_provider_profile(
        &mut self,
        input: DeleteProviderProfileInput,
    ) -> Result<ProviderProfileRecord, String> {
        let index = self
            .provider_profiles
            .iter()
            .position(|profile| profile.id == input.profile_id)
            .ok_or_else(|| "profile not found".to_string())?;
        let profile = self.provider_profiles.remove(index);

        for session in &mut self.sessions {
            if session.profile_id.as_deref() == Some(profile.id.as_str()) {
                session.profile_id = None;
            }
        }

        for pane in &mut self.panes {
            if pane.profile_id.as_deref() == Some(profile.id.as_str()) {
                pane.profile_id = None;
            }
        }

        Ok(profile)
    }

    pub fn assign_pane_profile(
        &mut self,
        input: AssignPaneProfileInput,
    ) -> Result<PaneRecord, String> {
        if let Some(profile_id) = input.profile_id.as_deref() {
            let exists = self
                .provider_profiles
                .iter()
                .any(|profile| profile.id == profile_id);
            if !exists {
                return Err("profile not found".into());
            }
        }

        let pane_index = self
            .panes
            .iter()
            .position(|pane| pane.id == input.pane_id)
            .ok_or_else(|| "pane not found".to_string())?;
        let now = now_ms();
        self.panes[pane_index].profile_id = input.profile_id.clone();
        self.panes[pane_index].updated_at = now;

        let session_id = self.panes[pane_index].session_id.clone();
        if let Some(session_index) = self
            .sessions
            .iter()
            .position(|session| session.id == session_id)
        {
            self.sessions[session_index].profile_id = input.profile_id;
            self.sessions[session_index].updated_at = now;
        }

        Ok(self.panes[pane_index].clone())
    }

    pub fn begin_composer_message(
        &mut self,
        input: SendComposerMessageInput,
    ) -> Result<MessageDispatch, String> {
        let content = input.content.trim();
        if content.is_empty() {
            return Err("composer content cannot be empty".into());
        }

        let now = now_ms();
        let pane_index = self
            .panes
            .iter()
            .position(|pane| pane.id == input.pane_id && pane.status == PaneStatus::Open)
            .ok_or_else(|| "pane not found".to_string())?;
        let pane_id = self.panes[pane_index].id.clone();
        let session_id = self.panes[pane_index].session_id.clone();
        let session_index = self
            .sessions
            .iter()
            .position(|session| session.id == session_id)
            .ok_or_else(|| "session not found".to_string())?;
        let project_id = self.sessions[session_index].project_id.clone();
        let project_path = self
            .projects
            .iter()
            .find(|project| project.id == project_id)
            .map(|project| project.path.clone())
            .ok_or_else(|| "project not found".to_string())?;
        let profile_id = self.panes[pane_index]
            .profile_id
            .clone()
            .or_else(|| self.sessions[session_index].profile_id.clone());

        let message = ComposerMessage {
            id: self.next_id("message"),
            session_id: session_id.clone(),
            role: MessageRole::User,
            content: content.into(),
            created_at: now,
        };
        self.messages.push(message.clone());

        let draft = if let Some(draft) = self
            .drafts
            .iter_mut()
            .find(|draft| draft.session_id == session_id)
        {
            draft.text.clear();
            draft.is_streaming = false;
            draft.updated_at = now;
            draft.clone()
        } else {
            let draft = ComposerDraft {
                session_id: session_id.clone(),
                text: String::new(),
                is_streaming: false,
                updated_at: now,
            };
            self.drafts.push(draft.clone());
            draft
        };

        self.sessions[session_index].status = SessionStatus::Busy;
        self.sessions[session_index].last_message_preview = truncate(content, 72);
        self.sessions[session_index].updated_at = now;
        self.active_session_id = Some(session_id.clone());

        let _ = draft;

        Ok(MessageDispatch {
            pane_id,
            session_id,
            project_path,
            provider: self.sessions[session_index].provider.clone(),
            profile_id,
            profile_label: None,
            base_url: None,
            api_key: None,
            model: None,
            user_message: message,
        })
    }

    pub fn complete_composer_message(
        &mut self,
        completion: MessageCompletion,
    ) -> Result<SendComposerMessageResult, String> {
        let now = now_ms();
        let session_index = self
            .sessions
            .iter()
            .position(|session| session.id == completion.session_id)
            .ok_or_else(|| "session not found".to_string())?;

        let assistant_message = ComposerMessage {
            id: self.next_id("message"),
            session_id: completion.session_id.clone(),
            role: completion.assistant_role,
            content: completion.assistant_content,
            created_at: now,
        };
        self.messages.push(assistant_message.clone());

        let draft = if let Some(draft) = self
            .drafts
            .iter_mut()
            .find(|draft| draft.session_id == completion.session_id)
        {
            draft.text.clear();
            draft.is_streaming = false;
            draft.updated_at = now;
            draft.clone()
        } else {
            let draft = ComposerDraft {
                session_id: completion.session_id.clone(),
                text: String::new(),
                is_streaming: false,
                updated_at: now,
            };
            self.drafts.push(draft.clone());
            draft
        };

        self.sessions[session_index].status = completion.session_status;
        self.sessions[session_index].last_message_preview =
            truncate(&assistant_message.content, 72);
        self.sessions[session_index].updated_at = now;
        self.active_session_id = Some(completion.session_id.clone());
        self.workspace.last_sync_at = now;

        let provider = self.sessions[session_index].provider.clone();
        if let Some(health) = self
            .remote_status
            .provider_health
            .iter_mut()
            .find(|candidate| candidate.provider == provider)
        {
            health.status = completion.provider_status;
            health.latency_ms = completion.provider_latency_ms;
            health.note = completion.provider_note.clone();
        }

        let message = self
            .messages
            .iter()
            .rev()
            .find(|message| {
                message.session_id == completion.session_id && message.role == MessageRole::User
            })
            .cloned()
            .ok_or_else(|| "user message not found".to_string())?;

        Ok(SendComposerMessageResult {
            message,
            assistant_message,
            session: self.sessions[session_index].clone(),
            draft,
        })
    }

    pub fn remote_status(&self) -> RemoteStatus {
        self.remote_status.clone()
    }

    pub fn set_workspace_layout(
        &mut self,
        input: SetWorkspaceLayoutInput,
    ) -> Result<WorkspaceSummary, String> {
        let layout_mode = input.layout_mode.trim();
        if layout_mode.is_empty() {
            return Err("layout mode cannot be empty".into());
        }

        self.workspace.layout_mode = layout_mode.to_string();
        self.workspace.last_sync_at = now_ms();
        Ok(self.workspace.clone())
    }

    pub fn toggle_remote_tunnel(
        &mut self,
        input: ToggleRemoteTunnelInput,
    ) -> Result<RemoteStatus, String> {
        let now = now_ms();
        self.remote_status.frp.enabled = input.enabled;
        self.remote_status.frp.active_tunnels = if input.enabled { 1 } else { 0 };
        self.remote_status.frp.status = if input.enabled {
            ConnectionState::Connected
        } else {
            ConnectionState::Disconnected
        };
        self.remote_status.frp.note = if input.enabled {
            "FRP tunnel enabled with mock connectivity state.".into()
        } else {
            "FRP tunnel disabled locally; waiting for daemon-backed control.".into()
        };
        self.remote_status.connection = if input.enabled {
            ConnectionState::Degraded
        } else {
            ConnectionState::Disconnected
        };
        self.remote_status.updated_at = now;
        Ok(self.remote_status.clone())
    }

    fn next_id(&mut self, prefix: &str) -> String {
        self.next_id += 1;
        format!("{prefix}_{}", self.next_id)
    }
}

pub fn mock_assistant_reply(content: &str) -> String {
    format!(
        "Mock assistant reply: queued your request and summarized the next step as \"{}\".",
        truncate(content, 48)
    )
}

fn truncate(value: &str, max_chars: usize) -> String {
    let mut collected = String::new();
    let mut count = 0usize;
    for ch in value.chars() {
        if count == max_chars {
            collected.push('…');
            return collected;
        }
        collected.push(ch);
        count += 1;
    }
    collected
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
