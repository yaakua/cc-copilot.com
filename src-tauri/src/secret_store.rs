#[derive(Debug, Clone, Default)]
pub struct SecretStore;

impl SecretStore {
    pub fn new() -> Self {
        Self
    }

    pub fn set_profile_api_key(&self, profile_id: &str, api_key: &str) -> Result<(), String> {
        let entry = self.entry(profile_id)?;
        entry
            .set_password(api_key)
            .map_err(|error| format!("failed to store api key for {profile_id}: {error}"))
    }

    pub fn get_profile_api_key(&self, profile_id: &str) -> Result<Option<String>, String> {
        let entry = self.entry(profile_id)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(format!(
                "failed to read api key for {profile_id} from keychain: {error}"
            )),
        }
    }

    pub fn delete_profile_api_key(&self, profile_id: &str) -> Result<(), String> {
        let entry = self.entry(profile_id)?;
        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "failed to remove api key for {profile_id} from keychain: {error}"
            )),
        }
    }

    fn entry(&self, profile_id: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new("cc-copilot-next.provider-profile", profile_id)
            .map_err(|error| format!("failed to access local keychain: {error}"))
    }
}
