use crate::models::{
    ComposerDraft, ComposerMessage, ConnectionState, FrpStatus, MessageRole, PaneKind, PaneRecord,
    PaneStatus, ProfileAuthKind, ProjectRecord, ProviderHealth, ProviderKind,
    ProviderProfileRecord, RemoteStatus, SessionRecord, SessionStatus, WorkspaceSummary,
};
use crate::store::{now_ms, Store};

pub fn seeded_store() -> Store {
    let now = now_ms();
    let project_alpha = ProjectRecord {
        id: "project_1".into(),
        name: "cc-copilot-next".into(),
        path: "/Users/yangkui/workspace/github/cc-copilot-next".into(),
        session_ids: vec!["session_1".into(), "session_2".into()],
        created_at: now.saturating_sub(7_200_000),
        updated_at: now.saturating_sub(90_000),
    };
    let project_beta = ProjectRecord {
        id: "project_2".into(),
        name: "shared-design-lab".into(),
        path: "/Users/yangkui/workspace/github/shared-design-lab".into(),
        session_ids: vec!["session_3".into()],
        created_at: now.saturating_sub(10_800_000),
        updated_at: now.saturating_sub(240_000),
    };
    let sessions = vec![
        SessionRecord {
            id: "session_1".into(),
            project_id: project_alpha.id.clone(),
            title: "Tauri workspace backend".into(),
            provider: ProviderKind::Anthropic,
            profile_id: Some("profile_1".into()),
            status: SessionStatus::Busy,
            last_message_preview: "Scaffold app state and IPC commands".into(),
            created_at: now.saturating_sub(3_600_000),
            updated_at: now.saturating_sub(30_000),
        },
        SessionRecord {
            id: "session_2".into(),
            project_id: project_alpha.id.clone(),
            title: "Streaming composer polish".into(),
            provider: ProviderKind::OpenAi,
            profile_id: Some("profile_2".into()),
            status: SessionStatus::Idle,
            last_message_preview: "Need provider switcher states".into(),
            created_at: now.saturating_sub(2_600_000),
            updated_at: now.saturating_sub(120_000),
        },
        SessionRecord {
            id: "session_3".into(),
            project_id: project_beta.id.clone(),
            title: "Preview pane bug bash".into(),
            provider: ProviderKind::Mock,
            profile_id: None,
            status: SessionStatus::Idle,
            last_message_preview: "Logs pane clipped on resize".into(),
            created_at: now.saturating_sub(5_600_000),
            updated_at: now.saturating_sub(600_000),
        },
    ];
    let panes = vec![PaneRecord {
        id: "pane_1".into(),
        session_id: "session_1".into(),
        title: "Main chat".into(),
        kind: PaneKind::Chat,
        profile_id: Some("profile_1".into()),
        status: PaneStatus::Open,
        is_focused: true,
        created_at: now.saturating_sub(3_600_000),
        updated_at: now.saturating_sub(20_000),
    }];
    let drafts = vec![
        ComposerDraft {
            session_id: "session_1".into(),
            text: "Summarize the pending backend API surface.".into(),
            is_streaming: false,
            updated_at: now.saturating_sub(15_000),
        },
        ComposerDraft {
            session_id: "session_2".into(),
            text: String::new(),
            is_streaming: false,
            updated_at: now.saturating_sub(180_000),
        },
    ];
    let messages = vec![ComposerMessage {
        id: "message_1".into(),
        session_id: "session_1".into(),
        role: MessageRole::Assistant,
        content: "Backend skeleton is ready for review.".into(),
        created_at: now.saturating_sub(60_000),
    }];
    let provider_profiles = vec![
        ProviderProfileRecord {
            id: "profile_1".into(),
            provider: ProviderKind::Anthropic,
            label: "Claude Primary".into(),
            auth_kind: ProfileAuthKind::System,
            base_url: String::new(),
            model: None,
            api_key_present: false,
            created_at: now.saturating_sub(7_000_000),
            updated_at: now.saturating_sub(7_000_000),
        },
        ProviderProfileRecord {
            id: "profile_2".into(),
            provider: ProviderKind::OpenAi,
            label: "Codex Gateway".into(),
            auth_kind: ProfileAuthKind::ApiKey,
            base_url: "https://api.openai.com/v1".into(),
            model: Some("gpt-5-codex".into()),
            api_key_present: false,
            created_at: now.saturating_sub(6_000_000),
            updated_at: now.saturating_sub(6_000_000),
        },
    ];
    let remote_status = RemoteStatus {
        connection: ConnectionState::Degraded,
        frp: FrpStatus {
            enabled: true,
            server_addr: "mock-gateway.local:7000".into(),
            active_tunnels: 1,
            status: ConnectionState::Connected,
            note: "FRP uses mock heartbeat data until the daemon integration lands.".into(),
        },
        provider_health: vec![
            ProviderHealth {
                provider: ProviderKind::Anthropic,
                status: ConnectionState::Connected,
                latency_ms: 182,
                note: "Primary workspace model route".into(),
            },
            ProviderHealth {
                provider: ProviderKind::OpenAi,
                status: ConnectionState::Degraded,
                latency_ms: 420,
                note: "Fallback provider using stubbed metrics".into(),
            },
            ProviderHealth {
                provider: ProviderKind::Mock,
                status: ConnectionState::Connected,
                latency_ms: 12,
                note: "Deterministic local development backend".into(),
            },
        ],
        updated_at: now.saturating_sub(10_000),
    };

    Store {
        workspace: WorkspaceSummary {
            app_name: "CC Copilot Workspace".into(),
            layout_mode: "single".into(),
            provider_mode: "hybrid".into(),
            last_sync_at: now.saturating_sub(8_000),
        },
        projects: vec![project_alpha, project_beta],
        provider_profiles,
        sessions,
        panes,
        drafts,
        messages,
        remote_status,
        next_id: 100,
        active_project_id: Some("project_1".into()),
        active_session_id: Some("session_1".into()),
    }
}
