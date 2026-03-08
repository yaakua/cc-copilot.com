use std::{
    env, fs,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use crate::{
    models::{
        ConnectionState, MessageRole, ProviderAuthLaunchResult, ProviderConnectionTestResult,
        ProviderHealth, ProviderKind, SessionStatus,
    },
    store::{mock_assistant_reply, MessageCompletion, MessageDispatch},
};
use serde_json::Value;

#[derive(Clone, Copy)]
pub struct ProviderRuntimeConfig<'a> {
    pub provider: &'a ProviderKind,
    pub profile_id: Option<&'a str>,
    pub profile_label: Option<&'a str>,
    pub base_url: Option<&'a str>,
    pub api_key: Option<&'a str>,
    pub model: Option<&'a str>,
}

pub fn probe_provider_health() -> Vec<ProviderHealth> {
    vec![
        probe_claude_health(),
        probe_codex_health(),
        ProviderHealth {
            provider: ProviderKind::Mock,
            status: ConnectionState::Connected,
            latency_ms: 12,
            note: "Deterministic local development backend.".into(),
        },
    ]
}

pub fn execute_message(dispatch: &MessageDispatch) -> MessageCompletion {
    stream_message(dispatch, |_, _| {}, |_| {})
}

pub fn test_provider_connection(config: ProviderRuntimeConfig<'_>) -> ProviderConnectionTestResult {
    if cfg!(test) || env::var("CC_COPILOT_NEXT_DISABLE_PROVIDERS").as_deref() == Ok("1") {
        return ProviderConnectionTestResult {
            provider: config.provider.clone(),
            ok: true,
            latency_ms: 12,
            message: format!(
                "{} test completed in local preview mode.",
                provider_name(config.provider)
            ),
        };
    }

    let started_at = Instant::now();
    let attempt = match config.provider {
        ProviderKind::OpenAi => run_codex_connection_test(&config),
        ProviderKind::Anthropic => run_claude_connection_test(&config),
        ProviderKind::Mock => Ok("Mock provider test completed.".into()),
    };
    let latency_ms = started_at.elapsed().as_millis().min(u32::MAX as u128) as u32;

    match attempt {
        Ok(detail) => ProviderConnectionTestResult {
            provider: config.provider.clone(),
            ok: true,
            latency_ms,
            message: format!(
                "{}\n{}",
                success_note_for_runtime(&config, latency_ms, true),
                detail
            ),
        },
        Err(error) => ProviderConnectionTestResult {
            provider: config.provider.clone(),
            ok: false,
            latency_ms,
            message: format!(
                "{}\nReason: {error}",
                success_note_for_runtime(&config, latency_ms, false)
            ),
        },
    }
}

pub fn launch_provider_login(provider: &ProviderKind) -> Result<ProviderAuthLaunchResult, String> {
    let workspace = current_project_path();
    let message = match provider {
        ProviderKind::OpenAi => {
            open_login_terminal("Codex CLI", &workspace, "codex login")?;
            "Opened a terminal window for `codex login`.".to_string()
        }
        ProviderKind::Anthropic => {
            let command =
                "printf '\\nRun /login inside Claude Code to authenticate this machine.\\n\\n'; claude";
            open_login_terminal("Claude Code", &workspace, command)?;
            "Opened a terminal window for Claude Code. Run `/login` there to authenticate."
                .to_string()
        }
        ProviderKind::Mock => "Mock provider does not require login.".to_string(),
    };

    Ok(ProviderAuthLaunchResult {
        provider: provider.clone(),
        message,
    })
}

pub fn stream_message<F, G>(
    dispatch: &MessageDispatch,
    mut on_delta: F,
    mut on_started: G,
) -> MessageCompletion
where
    F: FnMut(MessageRole, &str),
    G: FnMut(u32),
{
    if cfg!(test) || env::var("CC_COPILOT_NEXT_DISABLE_PROVIDERS").as_deref() == Ok("1") {
        let content = mock_assistant_reply(&dispatch.user_message.content);
        on_delta(MessageRole::Assistant, &content);
        return MessageCompletion {
            session_id: dispatch.session_id.clone(),
            assistant_role: MessageRole::Assistant,
            assistant_content: content,
            session_status: SessionStatus::Idle,
            provider_status: ConnectionState::Connected,
            provider_latency_ms: 12,
            provider_note: "Mock provider completed locally.".into(),
        };
    }

    let started_at = Instant::now();
    let attempt = match dispatch.provider {
        ProviderKind::OpenAi => run_codex_stream(dispatch, &mut on_delta, &mut on_started),
        ProviderKind::Anthropic => run_claude_stream(dispatch, &mut on_delta, &mut on_started),
        ProviderKind::Mock => {
            let content = mock_assistant_reply(&dispatch.user_message.content);
            on_delta(MessageRole::Assistant, &content);
            Ok(content)
        }
    };
    let latency_ms = started_at.elapsed().as_millis().min(u32::MAX as u128) as u32;

    match attempt {
        Ok(content) => MessageCompletion {
            session_id: dispatch.session_id.clone(),
            assistant_role: MessageRole::Assistant,
            assistant_content: content,
            session_status: SessionStatus::Idle,
            provider_status: ConnectionState::Connected,
            provider_latency_ms: latency_ms,
            provider_note: success_note(dispatch, latency_ms),
        },
        Err(error) => MessageCompletion {
            session_id: dispatch.session_id.clone(),
            assistant_role: MessageRole::System,
            assistant_content: format!(
                "{}\n\nFallback preview:\n{}",
                provider_error_summary(dispatch, &error),
                mock_assistant_reply(&dispatch.user_message.content)
            ),
            session_status: SessionStatus::Error,
            provider_status: ConnectionState::Disconnected,
            provider_latency_ms: latency_ms,
            provider_note: provider_error_summary(dispatch, &error),
        },
    }
}

fn run_codex_stream<F, G>(
    dispatch: &MessageDispatch,
    on_delta: &mut F,
    on_started: &mut G,
) -> Result<String, String>
where
    F: FnMut(MessageRole, &str),
    G: FnMut(u32),
{
    let mut command = Command::new("codex");
    command.current_dir(&dispatch.project_path).args([
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
        "-C",
        &dispatch.project_path,
    ]);
    if dispatch.api_key.is_none() {
        if let Some(model) = dispatch.model.as_deref() {
            command.args(["--model", model]);
        }
    }
    apply_codex_profile_env(&mut command, dispatch)?;
    command.arg(&dispatch.user_message.content);

    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to launch codex: {error}"))?;
    on_started(child.id());

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture codex stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture codex stderr".to_string())?;

    let stderr_handle = thread::spawn(move || read_to_string(stderr));
    let mut assistant_text = String::new();

    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| format!("failed to read codex output: {error}"))?;
        if let Some(delta) = parse_codex_json_line(&line) {
            assistant_text.push_str(&delta);
            on_delta(MessageRole::Assistant, &delta);
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("failed to wait for codex: {error}"))?;
    let stderr = stderr_handle
        .join()
        .map_err(|_| "failed to join codex stderr thread".to_string())?;

    if status.success() && !assistant_text.trim().is_empty() {
        return Ok(assistant_text);
    }

    Err(render_process_error(
        "codex",
        assistant_text.trim(),
        stderr.trim(),
    ))
}

fn run_claude_stream<F, G>(
    dispatch: &MessageDispatch,
    on_delta: &mut F,
    on_started: &mut G,
) -> Result<String, String>
where
    F: FnMut(MessageRole, &str),
    G: FnMut(u32),
{
    let mut command = Command::new("claude");
    command.current_dir(&dispatch.project_path).args([
        "-p",
        "--verbose",
        "--output-format",
        "stream-json",
        "--include-partial-messages",
        "--dangerously-skip-permissions",
    ]);
    if let Some(model) = dispatch.model.as_deref() {
        command.args(["--model", model]);
    }
    apply_claude_profile_env(&mut command, dispatch);
    command.arg(&dispatch.user_message.content);

    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to launch claude: {error}"))?;
    on_started(child.id());

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture claude stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture claude stderr".to_string())?;

    let stderr_handle = thread::spawn(move || read_to_string(stderr));
    let mut assistant_text = String::new();
    let mut claude_error: Option<String> = None;

    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| format!("failed to read claude output: {error}"))?;
        let parsed = parse_claude_json_line(&line, &assistant_text);
        if let Some(delta) = parsed.delta {
            assistant_text.push_str(&delta);
            on_delta(parsed.role.clone(), &delta);
        }
        if claude_error.is_none() {
            claude_error = parsed.error;
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("failed to wait for claude: {error}"))?;
    let stderr = stderr_handle
        .join()
        .map_err(|_| "failed to join claude stderr thread".to_string())?;

    if let Some(error) = claude_error {
        if error.contains("Not logged in") {
            return Err(
                "claude is installed but not logged in on this machine. Run claude /login first."
                    .into(),
            );
        }
        return Err(error);
    }

    if status.success() && !assistant_text.trim().is_empty() {
        return Ok(assistant_text);
    }

    Err(render_process_error(
        "claude",
        assistant_text.trim(),
        stderr.trim(),
    ))
}

fn apply_codex_profile_env(
    command: &mut Command,
    dispatch: &MessageDispatch,
) -> Result<(), String> {
    apply_codex_runtime_env(
        command,
        ProviderRuntimeConfig {
            provider: &dispatch.provider,
            profile_id: dispatch.profile_id.as_deref(),
            profile_label: dispatch.profile_label.as_deref(),
            base_url: dispatch.base_url.as_deref(),
            api_key: dispatch.api_key.as_deref(),
            model: dispatch.model.as_deref(),
        },
    )
}

fn apply_claude_profile_env(command: &mut Command, dispatch: &MessageDispatch) {
    apply_claude_runtime_env(
        command,
        ProviderRuntimeConfig {
            provider: &dispatch.provider,
            profile_id: dispatch.profile_id.as_deref(),
            profile_label: dispatch.profile_label.as_deref(),
            base_url: dispatch.base_url.as_deref(),
            api_key: dispatch.api_key.as_deref(),
            model: dispatch.model.as_deref(),
        },
    );
}

fn apply_codex_runtime_env(
    command: &mut Command,
    config: ProviderRuntimeConfig<'_>,
) -> Result<(), String> {
    let Some(api_key) = config.api_key else {
        return Ok(());
    };

    let runtime_home = write_codex_runtime(&config)?;
    command.env("CODEX_HOME", runtime_home);
    command.env("CC_COPILOT_NEXT_CODEX_API_KEY", api_key);
    command.env("OPENAI_API_KEY", api_key);
    if let Some(base_url) = config.base_url {
        command.env("OPENAI_BASE_URL", base_url);
    }

    Ok(())
}

fn apply_claude_runtime_env(command: &mut Command, config: ProviderRuntimeConfig<'_>) {
    let Some(api_key) = config.api_key else {
        return;
    };

    if let Some(base_url) = config.base_url {
        command.env("CLAUDE_CODE_USE_FOUNDRY", "1");
        command.env("CLAUDE_CODE_SKIP_FOUNDRY_AUTH", "1");
        command.env("ANTHROPIC_FOUNDRY_BASE_URL", base_url);
        command.env("ANTHROPIC_FOUNDRY_API_KEY", api_key);
    } else {
        command.env("ANTHROPIC_API_KEY", api_key);
    }
}

fn write_codex_runtime(config: &ProviderRuntimeConfig<'_>) -> Result<PathBuf, String> {
    let dir = env::temp_dir().join(format!(
        "cc-copilot-next-codex-{}-{}",
        config.profile_id.unwrap_or("default"),
        timestamp_ms()
    ));
    fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create isolated Codex runtime directory: {error}"))?;

    let mut file_content = String::new();
    file_content.push_str(&format!(
        "model = \"{}\"\n",
        config.model.unwrap_or("gpt-5-codex")
    ));
    file_content.push_str("model_provider = \"cc_copilot_profile\"\n\n");
    file_content.push_str("[model_providers.cc_copilot_profile]\n");
    file_content.push_str("name = \"cc_copilot_profile\"\n");
    file_content.push_str("wire_api = \"responses\"\n");
    file_content.push_str("env_key = \"CC_COPILOT_NEXT_CODEX_API_KEY\"\n");
    if let Some(base_url) = config.base_url {
        file_content.push_str(&format!("base_url = \"{}\"\n", escape_toml(base_url)));
    } else {
        file_content.push_str("base_url = \"https://api.openai.com/v1\"\n");
    }

    fs::write(dir.join("config.toml"), file_content)
        .map_err(|error| format!("failed to write isolated Codex config: {error}"))?;
    Ok(dir)
}

fn run_codex_connection_test(config: &ProviderRuntimeConfig<'_>) -> Result<String, String> {
    let mut command = Command::new("codex");
    let project_path = current_project_path();
    command.current_dir(&project_path).args([
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
        "-C",
        &project_path,
        "Reply with OK and nothing else.",
    ]);
    if config.api_key.is_none() {
        if let Some(model) = config.model {
            command.args(["--model", model]);
        }
    }
    apply_codex_runtime_env(&mut command, ProviderRuntimeConfig { ..*config })?;

    let output = command
        .output()
        .map_err(|error| format!("failed to launch codex: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(render_process_error("codex", stdout.trim(), stderr.trim()));
    }

    if stdout
        .lines()
        .filter_map(parse_codex_json_line)
        .any(|line| line.trim() == "OK")
    {
        return Ok("Received expected OK confirmation from Codex CLI.".into());
    }

    Err("codex test did not return the expected confirmation.".into())
}

fn run_claude_connection_test(config: &ProviderRuntimeConfig<'_>) -> Result<String, String> {
    let mut command = Command::new("claude");
    let project_path = current_project_path();
    command.current_dir(&project_path).args([
        "-p",
        "--output-format",
        "stream-json",
        "--dangerously-skip-permissions",
        "Reply with OK and nothing else.",
    ]);
    if let Some(model) = config.model {
        command.args(["--model", model]);
    }
    apply_claude_runtime_env(&mut command, ProviderRuntimeConfig { ..*config });

    let output = command
        .output()
        .map_err(|error| format!("failed to launch claude: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(render_process_error("claude", stdout.trim(), stderr.trim()));
    }

    let mut assistant_text = String::new();
    for line in stdout.lines() {
        let parsed = parse_claude_json_line(line, &assistant_text);
        if let Some(error) = parsed.error {
            return Err(error);
        }
        if let Some(delta) = parsed.delta {
            assistant_text.push_str(&delta);
        }
    }

    if assistant_text.trim() == "OK" {
        return Ok("Received expected OK confirmation from Claude Code.".into());
    }

    Err("claude test did not return the expected confirmation.".into())
}

fn parse_codex_json_line(line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line).ok()?;
    if value.get("type")?.as_str()? != "item.completed" {
        return None;
    }

    let item = value.get("item")?;
    if item.get("type")?.as_str()? != "agent_message" {
        return None;
    }

    let text = item.get("text")?.as_str()?.trim();
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

fn parse_claude_json_line(line: &str, previous_text: &str) -> ClaudeParsedLine {
    let mut parsed = ClaudeParsedLine::default();
    let value: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(_) => return parsed,
    };

    match value.get("type").and_then(Value::as_str) {
        Some("assistant") => {
            let message = match value.get("message") {
                Some(message) => message,
                None => return parsed,
            };
            if let Some(error) = value.get("error").and_then(Value::as_str) {
                parsed.error = Some(error.to_string());
            }

            let content = message
                .get("content")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item.get("text").and_then(Value::as_str))
                        .collect::<String>()
                })
                .unwrap_or_default();

            if !content.is_empty() {
                parsed.role = MessageRole::Assistant;
                parsed.delta = diff_suffix(previous_text, &content);
            }
        }
        Some("result") => {
            let is_error = value
                .get("is_error")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if is_error {
                parsed.role = MessageRole::System;
                parsed.error = value
                    .get("result")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or_else(|| {
                        value
                            .get("error")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    });
            }
        }
        _ => {}
    }

    parsed
}

fn probe_claude_health() -> ProviderHealth {
    match version_output("claude") {
        Ok(version) => ProviderHealth {
            provider: ProviderKind::Anthropic,
            status: ConnectionState::Degraded,
            latency_ms: 80,
            note: format!(
                "{version} detected locally. Login state is validated when the first request runs."
            ),
        },
        Err(error) => ProviderHealth {
            provider: ProviderKind::Anthropic,
            status: ConnectionState::Disconnected,
            latency_ms: 0,
            note: format!("Claude Code not available: {error}"),
        },
    }
}

fn probe_codex_health() -> ProviderHealth {
    match version_output("codex") {
        Ok(version) => ProviderHealth {
            provider: ProviderKind::OpenAi,
            status: ConnectionState::Connected,
            latency_ms: 65,
            note: format!("{version} detected locally and ready for exec mode."),
        },
        Err(error) => ProviderHealth {
            provider: ProviderKind::OpenAi,
            status: ConnectionState::Disconnected,
            latency_ms: 0,
            note: format!("Codex CLI not available: {error}"),
        },
    }
}

fn diff_suffix(previous: &str, next: &str) -> Option<String> {
    if next.is_empty() {
        return None;
    }
    if previous.is_empty() {
        return Some(next.to_string());
    }
    if let Some(suffix) = next.strip_prefix(previous) {
        if suffix.is_empty() {
            None
        } else {
            Some(suffix.to_string())
        }
    } else if previous != next {
        Some(next.to_string())
    } else {
        None
    }
}

fn render_process_error(command: &str, stdout: &str, stderr: &str) -> String {
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        "command returned no output"
    };
    format!("{command} execution failed: {detail}")
}

fn provider_error_summary(dispatch: &MessageDispatch, error: &str) -> String {
    let name = provider_name(&dispatch.provider);
    let profile = dispatch
        .profile_label
        .as_deref()
        .map(|label| format!(" ({label})"))
        .unwrap_or_default();
    format!("{name}{profile} is currently unavailable.\nReason: {error}")
}

fn success_note_for_runtime(
    config: &ProviderRuntimeConfig<'_>,
    latency_ms: u32,
    success: bool,
) -> String {
    let name = provider_name(config.provider);
    let profile = config
        .profile_label
        .map(|label| format!(" via {label}"))
        .unwrap_or_default();
    if success {
        format!("{name}{profile} test succeeded in {latency_ms}ms.")
    } else {
        format!("{name}{profile} test failed after {latency_ms}ms.")
    }
}

fn success_note(dispatch: &MessageDispatch, latency_ms: u32) -> String {
    let name = provider_name(&dispatch.provider);
    let profile = dispatch
        .profile_label
        .as_deref()
        .map(|label| format!(" via {label}"))
        .unwrap_or_default();
    format!("{name}{profile} responded in {latency_ms}ms.")
}

fn current_project_path() -> String {
    env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .into_owned()
}

fn open_login_terminal(title: &str, workspace: &str, shell_command: &str) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let script = format!(
            "tell application \"Terminal\"\nactivate\ndo script \"cd {} && {}\"\nend tell",
            escape_applescript_shell(workspace),
            escape_applescript_shell(shell_command),
        );
        Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|error| format!("failed to open Terminal for {title}: {error}"))?;
        return Ok(());
    }

    if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args([
                "/C",
                "start",
                title,
                "cmd",
                "/K",
                &format!("cd /d \"{}\" && {}", workspace, shell_command),
            ])
            .spawn()
            .map_err(|error| format!("failed to open terminal for {title}: {error}"))?;
        return Ok(());
    }

    Err(format!(
        "{title} login launcher is not implemented on this platform yet."
    ))
}

fn escape_applescript_shell(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn provider_name(provider: &ProviderKind) -> &'static str {
    match provider {
        ProviderKind::Anthropic => "Claude Code",
        ProviderKind::OpenAi => "Codex CLI",
        ProviderKind::Mock => "Mock Provider",
    }
}

fn version_output(command: &str) -> Result<String, String> {
    let output = Command::new(command)
        .arg("--version")
        .output()
        .map_err(|error| format!("failed to launch {command}: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        let version = if !stdout.is_empty() { stdout } else { stderr };
        if version.is_empty() {
            Ok(format!("{command} installed"))
        } else {
            Ok(version)
        }
    } else {
        Err(render_process_error(command, &stdout, &stderr))
    }
}

fn read_to_string<R: Read>(mut reader: R) -> String {
    let mut output = String::new();
    let _ = reader.read_to_string(&mut output);
    output
}

fn escape_toml(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

struct ClaudeParsedLine {
    role: MessageRole,
    delta: Option<String>,
    error: Option<String>,
}

impl Default for ClaudeParsedLine {
    fn default() -> Self {
        Self {
            role: MessageRole::Assistant,
            delta: None,
            error: None,
        }
    }
}
