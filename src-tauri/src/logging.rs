use std::{
    env, fs,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, EnvFilter};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static LOG_GUARD: OnceLock<Mutex<WorkerGuard>> = OnceLock::new();

pub fn init_logging() -> Result<PathBuf, String> {
    if let Some(path) = LOG_PATH.get() {
        return Ok(path.clone());
    }

    let log_dir = app_home_dir().join("logs");
    fs::create_dir_all(&log_dir)
        .map_err(|error| format!("failed to create log directory: {error}"))?;
    let log_path = log_dir.join("app.log");

    let appender = tracing_appender::rolling::never(&log_dir, "app.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let subscriber = fmt()
        .with_env_filter(filter)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(true)
        .with_writer(writer)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .map_err(|error| format!("failed to initialize tracing subscriber: {error}"))?;

    let _ = LOG_GUARD.set(Mutex::new(guard));
    let _ = LOG_PATH.set(log_path.clone());
    Ok(log_path)
}

fn app_home_dir() -> PathBuf {
    env::var_os("CC_COPILOT_NEXT_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".cc-copilot-next")))
        .unwrap_or_else(|| PathBuf::from(".cc-copilot-next"))
}
