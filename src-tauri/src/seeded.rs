use crate::models::{
    ConnectionState, FrpStatus, RemoteStatus, WorkspaceSummary,
};
use crate::store::{now_ms, Store};

pub fn seeded_store() -> Store {
    let now = now_ms();
    let remote_status = RemoteStatus {
        connection: ConnectionState::Disconnected,
        frp: FrpStatus {
            enabled: false,
            server_addr: String::new(),
            active_tunnels: 0,
            status: ConnectionState::Disconnected,
            note: "Remote tunnel is not enabled.".into(),
        },
        provider_health: Vec::new(),
        updated_at: now,
    };

    Store {
        workspace: WorkspaceSummary {
            app_name: "CC Copilot Workspace".into(),
            layout_mode: "single".into(),
            provider_mode: "hybrid".into(),
            last_sync_at: now,
        },
        projects: Vec::new(),
        provider_profiles: Vec::new(),
        sessions: Vec::new(),
        panes: Vec::new(),
        drafts: Vec::new(),
        messages: Vec::new(),
        remote_status,
        next_id: 1,
        active_project_id: None,
        active_session_id: None,
    }
}
