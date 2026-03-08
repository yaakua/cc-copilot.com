use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use crate::seeded::seeded_store;
use crate::store::Store;

#[derive(Debug, Clone)]
pub struct Storage {
    path: PathBuf,
}

impl Storage {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn default() -> Self {
        Self::new(default_state_file_path())
    }

    pub fn load_or_seed(&self) -> Result<Store, String> {
        match fs::read_to_string(&self.path) {
            Ok(contents) => {
                let store: Store = serde_json::from_str(&contents).map_err(|error| {
                    format!(
                        "failed to parse state file {}: {error}",
                        self.path.display()
                    )
                })?;
                let migrated = migrate_seeded_demo_store(store);
                self.save(&migrated)?;
                Ok(migrated)
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let store = seeded_store();
                self.save(&store)?;
                Ok(store)
            }
            Err(error) => Err(format!(
                "failed to read state file {}: {error}",
                self.path.display()
            )),
        }
    }

    pub fn save(&self, store: &Store) -> Result<(), String> {
        ensure_parent_dir(&self.path)?;
        let json = serde_json::to_string_pretty(store)
            .map_err(|error| format!("failed to serialize state: {error}"))?;
        fs::write(&self.path, json).map_err(|error| {
            format!(
                "failed to write state file {}: {error}",
                self.path.display()
            )
        })
    }
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create state directory {}: {error}",
                parent.display()
            )
        })?;
    }

    Ok(())
}

fn migrate_seeded_demo_store(store: Store) -> Store {
    let demo_project_ids = ["project_1", "project_2"];
    let demo_session_ids = ["session_1", "session_2", "session_3"];
    let demo_pane_ids = ["pane_1"];

    let matches_demo_projects = store.projects.len() == demo_project_ids.len()
        && store
            .projects
            .iter()
            .map(|project| project.id.as_str())
            .eq(demo_project_ids.iter().copied());
    let matches_demo_sessions = store.sessions.len() == demo_session_ids.len()
        && store
            .sessions
            .iter()
            .map(|session| session.id.as_str())
            .eq(demo_session_ids.iter().copied());
    let matches_demo_panes = store.panes.len() == demo_pane_ids.len()
        && store
            .panes
            .iter()
            .map(|pane| pane.id.as_str())
            .eq(demo_pane_ids.iter().copied());

    if matches_demo_projects && matches_demo_sessions && matches_demo_panes {
        seeded_store()
    } else {
        store
    }
}

fn default_state_file_path() -> PathBuf {
    if let Some(path) = env::var_os("CC_COPILOT_NEXT_STATE_FILE") {
        return PathBuf::from(path);
    }

    home_dir()
        .unwrap_or_else(fallback_dir)
        .join(".cc-copilot-next")
        .join("dashboard-state.json")
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
}

fn fallback_dir() -> PathBuf {
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}
