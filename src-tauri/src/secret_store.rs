use std::{
    collections::HashMap,
    env, fs,
    path::PathBuf,
};

#[derive(Debug, Clone, Default)]
pub struct SecretStore;

impl SecretStore {
    pub fn new() -> Self {
        Self
    }

    pub fn set_profile_api_key(&self, profile_id: &str, api_key: &str) -> Result<(), String> {
        let mut secrets = self.load_secrets()?;
        secrets.insert(profile_id.to_string(), api_key.to_string());
        self.save_secrets(&secrets)?;
        Ok(())
    }

    pub fn get_profile_api_key(&self, profile_id: &str) -> Result<Option<String>, String> {
        Ok(self.load_secrets()?.remove(profile_id))
    }

    pub fn delete_profile_api_key(&self, profile_id: &str) -> Result<(), String> {
        let mut secrets = self.load_secrets()?;
        if secrets.remove(profile_id).is_some() {
            self.save_secrets(&secrets)?;
        }
        Ok(())
    }

    fn load_secrets(&self) -> Result<HashMap<String, String>, String> {
        let path = secret_file_path();
        match fs::read_to_string(&path) {
            Ok(contents) => serde_json::from_str(&contents).map_err(|error| {
                format!(
                    "failed to parse secret file {}: {error}",
                    path.display()
                )
            }),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
            Err(error) => Err(format!(
                "failed to read secret file {}: {error}",
                path.display()
            )),
        }
    }

    fn save_secrets(&self, secrets: &HashMap<String, String>) -> Result<(), String> {
        let path = secret_file_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "failed to create secret directory {}: {error}",
                    parent.display()
                )
            })?;
        }

        let contents = serde_json::to_string_pretty(secrets)
            .map_err(|error| format!("failed to serialize secrets: {error}"))?;
        fs::write(&path, contents).map_err(|error| {
            format!(
                "failed to write secret file {}: {error}",
                path.display()
            )
        })?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let permissions = fs::Permissions::from_mode(0o600);
            fs::set_permissions(&path, permissions).map_err(|error| {
                format!(
                    "failed to secure secret file {}: {error}",
                    path.display()
                )
            })?;
        }

        Ok(())
    }
}

fn secret_file_path() -> PathBuf {
    env::var_os("CC_COPILOT_NEXT_SECRET_FILE")
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("CC_COPILOT_NEXT_HOME")
                .map(|home| PathBuf::from(home).join("profile-secrets.json"))
        })
        .or_else(|| {
            env::var_os("HOME")
                .map(|home| PathBuf::from(home).join(".cc-copilot-next/profile-secrets.json"))
        })
        .unwrap_or_else(|| PathBuf::from(".cc-copilot-next/profile-secrets.json"))
}

#[cfg(test)]
mod tests {
    use super::SecretStore;
    use tempfile::tempdir;

    #[test]
    fn stores_and_reads_profile_secrets_from_json_file() {
        let dir = tempdir().expect("create tempdir");
        let secret_file = dir.path().join("profile-secrets.json");
        std::env::set_var("CC_COPILOT_NEXT_SECRET_FILE", &secret_file);

        let store = SecretStore::new();
        store
            .set_profile_api_key("profile_a", "secret-value")
            .expect("store secret");

        let resolved = store
            .get_profile_api_key("profile_a")
            .expect("read secret");
        assert_eq!(resolved.as_deref(), Some("secret-value"));

        store
            .delete_profile_api_key("profile_a")
            .expect("delete secret");
        let resolved = store
            .get_profile_api_key("profile_a")
            .expect("read deleted secret");
        assert_eq!(resolved, None);

        std::env::remove_var("CC_COPILOT_NEXT_SECRET_FILE");
    }
}
