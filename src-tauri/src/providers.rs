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
        ComposerStreamEventKind, ConnectionState, MessageRole, ProfileAuthKind,
        ProviderAuthLaunchResult, ProviderConnectionTestResult, ProviderHealth, ProviderKind,
        ProviderProfileRecord, SessionStatus,
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
    pub runtime_home: Option<&'a str>,
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
    stream_message(dispatch, |_| {}, |_| {})
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

pub fn launch_provider_login(
    provider: &ProviderKind,
    profile: Option<&ProviderProfileRecord>,
) -> Result<ProviderAuthLaunchResult, String> {
    let workspace = current_project_path();
    let message = match provider {
        ProviderKind::OpenAi => {
            if let Some(profile) = profile {
                if profile.auth_kind == ProfileAuthKind::Official {
                    let runtime_home = profile
                        .runtime_home
                        .as_deref()
                        .ok_or_else(|| "official Codex profile is missing runtime home".to_string())?;
                    fs::create_dir_all(runtime_home)
                        .map_err(|error| format!("failed to prepare Codex profile home: {error}"))?;
                    let command = format!(
                        "export CODEX_HOME=\"{}\"; codex login",
                        escape_shell(runtime_home)
                    );
                    open_login_terminal("Codex CLI", &workspace, &command)?;
                    format!("Opened a terminal window for `codex login` via profile {}.", profile.label)
                } else {
                    open_login_terminal("Codex CLI", &workspace, "codex login")?;
                    "Opened a terminal window for `codex login`.".to_string()
                }
            } else {
                open_login_terminal("Codex CLI", &workspace, "codex login")?;
                "Opened a terminal window for `codex login`.".to_string()
            }
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
    F: FnMut(ProviderStreamChunk),
    G: FnMut(u32),
{
    if cfg!(test) || env::var("CC_COPILOT_NEXT_DISABLE_PROVIDERS").as_deref() == Ok("1") {
        let content = mock_assistant_reply(&dispatch.user_message.content);
        on_delta(ProviderStreamChunk {
            message_id: format!("assistant-{}", dispatch.session_id),
            role: MessageRole::Assistant,
            kind: ComposerStreamEventKind::Message,
            chunk: content.clone(),
        });
        return MessageCompletion {
            session_id: dispatch.session_id.clone(),
            provider_session_id: dispatch.provider_session_id.clone(),
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
            on_delta(ProviderStreamChunk {
                message_id: format!("assistant-{}", dispatch.session_id),
                role: MessageRole::Assistant,
                kind: ComposerStreamEventKind::Message,
                chunk: content.clone(),
            });
            Ok(ProviderStreamResult {
                content,
                provider_session_id: dispatch.provider_session_id.clone(),
            })
        }
    };
    let latency_ms = started_at.elapsed().as_millis().min(u32::MAX as u128) as u32;

    match attempt {
        Ok(result) => MessageCompletion {
            session_id: dispatch.session_id.clone(),
            provider_session_id: result.provider_session_id,
            assistant_role: MessageRole::Assistant,
            assistant_content: result.content,
            session_status: SessionStatus::Idle,
            provider_status: ConnectionState::Connected,
            provider_latency_ms: latency_ms,
            provider_note: success_note(dispatch, latency_ms),
        },
        Err(error) => MessageCompletion {
            session_id: dispatch.session_id.clone(),
            provider_session_id: dispatch.provider_session_id.clone(),
            assistant_role: MessageRole::System,
            assistant_content: provider_error_summary(dispatch, &error),
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
) -> Result<ProviderStreamResult, String>
where
    F: FnMut(ProviderStreamChunk),
    G: FnMut(u32),
{
    let mut command = Command::new("codex");
    command.current_dir(&dispatch.project_path);
    if let Some(provider_session_id) = dispatch.provider_session_id.as_deref() {
        command.args([
            "exec",
            "resume",
            "--json",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            provider_session_id,
        ]);
    } else {
        command.args([
            "exec",
            "--json",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            "-C",
            &dispatch.project_path,
        ]);
    }
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
    let mut provider_session_id = dispatch.provider_session_id.clone();

    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| format!("failed to read codex output: {error}"))?;
        let parsed = parse_codex_json_line(&line, &dispatch.session_id);
        if provider_session_id.is_none() {
            provider_session_id = parsed.provider_session_id;
        }
        if let Some(delta) = parsed.delta {
            if delta.role == MessageRole::Assistant && delta.kind == ComposerStreamEventKind::Message {
                assistant_text.push_str(&delta.chunk);
            }
            on_delta(delta);
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("failed to wait for codex: {error}"))?;
    let stderr = stderr_handle
        .join()
        .map_err(|_| "failed to join codex stderr thread".to_string())?;

    if status.success() && !assistant_text.trim().is_empty() {
        return Ok(ProviderStreamResult {
            content: assistant_text,
            provider_session_id,
        });
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
) -> Result<ProviderStreamResult, String>
where
    F: FnMut(ProviderStreamChunk),
    G: FnMut(u32),
{
    let mut command = Command::new("claude");
    command.current_dir(&dispatch.project_path).arg("-p");
    if let Some(provider_session_id) = dispatch.provider_session_id.as_deref() {
        command.args(["--resume", provider_session_id]);
    }
    command.args([
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
    let mut provider_session_id = dispatch.provider_session_id.clone();
    let mut claude_error: Option<String> = None;

    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| format!("failed to read claude output: {error}"))?;
        let parsed = parse_claude_json_line(&line, &assistant_text);
        if provider_session_id.is_none() {
            provider_session_id = parsed.provider_session_id.clone();
        }
        if let Some(delta) = parsed.delta {
            if parsed.role == MessageRole::Assistant {
                assistant_text.push_str(&delta);
            }
            on_delta(ProviderStreamChunk {
                message_id: parsed
                    .message_id
                    .clone()
                    .unwrap_or_else(|| format!("assistant-{}", dispatch.session_id)),
                role: parsed.role.clone(),
                kind: parsed.kind.clone(),
                chunk: delta,
            });
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
        return Ok(ProviderStreamResult {
            content: assistant_text,
            provider_session_id,
        });
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
            runtime_home: dispatch.runtime_home.as_deref(),
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
            runtime_home: dispatch.runtime_home.as_deref(),
        },
    );
}

fn apply_codex_runtime_env(
    command: &mut Command,
    config: ProviderRuntimeConfig<'_>,
) -> Result<(), String> {
    if let Some(runtime_home) = config.runtime_home {
        fs::create_dir_all(runtime_home)
            .map_err(|error| format!("failed to prepare Codex runtime directory: {error}"))?;
        command.env("CODEX_HOME", runtime_home);
    }

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
        .filter_map(|line| parse_codex_json_line(line, "connection-test").delta)
        .any(|line| line.chunk.trim() == "OK")
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

fn parse_codex_json_line(line: &str, session_id: &str) -> ProviderParsedLine {
    let mut parsed = ProviderParsedLine::default();
    let value: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(_) => return parsed,
    };
    match value.get("type").and_then(Value::as_str) {
        Some("thread.started") => {
            parsed.provider_session_id = value
                .get("thread_id")
                .and_then(Value::as_str)
                .map(str::to_string);
        }
        Some("item.completed") => {
            let item = match value.get("item") {
                Some(item) => item,
                None => return parsed,
            };
            match item.get("type").and_then(Value::as_str) {
                Some("agent_message") => {
                    let text = item
                        .get("text")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .unwrap_or_default();
                    if !text.is_empty() {
                        parsed.delta = Some(ProviderStreamChunk {
                            message_id: format!("assistant-{session_id}"),
                            role: MessageRole::Assistant,
                            kind: ComposerStreamEventKind::Message,
                            chunk: text.to_string(),
                        });
                    }
                }
                Some("command_execution") => {
                    let command = item
                        .get("command")
                        .and_then(Value::as_str)
                        .map(summarize_command)
                        .unwrap_or_else(|| "调用工具".to_string());
                    let exit_code = item.get("exit_code").and_then(Value::as_i64);
                    let item_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or("tool");
                    let suffix = match exit_code {
                        Some(code) => format!(" 已完成 (exit {code})"),
                        None => " 已完成".to_string(),
                    };
                    parsed.delta = Some(ProviderStreamChunk {
                        message_id: format!("tool-{session_id}-{item_id}"),
                        role: MessageRole::System,
                        kind: ComposerStreamEventKind::ToolResult,
                        chunk: format!("{command}{suffix}"),
                    });
                }
                _ => {}
            }
        }
        Some("item.started") => {
            let item = match value.get("item") {
                Some(item) => item,
                None => return parsed,
            };
            if item.get("type").and_then(Value::as_str) == Some("command_execution") {
                let command = item
                    .get("command")
                    .and_then(Value::as_str)
                    .map(summarize_command)
                    .unwrap_or_else(|| "调用工具".to_string());
                let item_id = item
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("tool");
                parsed.delta = Some(ProviderStreamChunk {
                    message_id: format!("tool-{session_id}-{item_id}"),
                    role: MessageRole::System,
                    kind: ComposerStreamEventKind::ToolCall,
                    chunk: command,
                });
            }
        }
        _ => {}
    }
    parsed
}

fn parse_claude_json_line(line: &str, previous_text: &str) -> ClaudeParsedLine {
    let mut parsed = ClaudeParsedLine::default();
    let value: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(_) => return parsed,
    };

    match value.get("type").and_then(Value::as_str) {
        Some("system") => {
            parsed.provider_session_id = value
                .get("session_id")
                .and_then(Value::as_str)
                .map(str::to_string);
        }
        Some("assistant") => {
            let message = match value.get("message") {
                Some(message) => message,
                None => return parsed,
            };
            if let Some(error) = value.get("error").and_then(Value::as_str) {
                parsed.error = Some(error.to_string());
            }
            if parsed.provider_session_id.is_none() {
                parsed.provider_session_id = value
                    .get("session_id")
                    .and_then(Value::as_str)
                    .map(str::to_string);
            }

            let content = message
                .get("content")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| {
                            if item.get("type").and_then(Value::as_str) == Some("text") {
                                item.get("text").and_then(Value::as_str)
                            } else {
                                None
                            }
                        })
                        .collect::<String>()
                })
                .unwrap_or_default();

            if !content.is_empty() {
                parsed.role = MessageRole::Assistant;
                parsed.delta = diff_suffix(previous_text, &content);
                parsed.kind = ComposerStreamEventKind::Message;
            } else if let Some(items) = message.get("content").and_then(Value::as_array) {
                if let Some(process_event) = items.iter().find_map(parse_claude_process_item) {
                    parsed.role = MessageRole::System;
                    parsed.kind = process_event.kind;
                    parsed.message_id = Some(process_event.message_id);
                    parsed.delta = Some(process_event.chunk);
                }
            }
        }
        Some("result") => {
            if parsed.provider_session_id.is_none() {
                parsed.provider_session_id = value
                    .get("session_id")
                    .and_then(Value::as_str)
                    .map(str::to_string);
            }
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

#[derive(Default)]
struct ProviderParsedLine {
    delta: Option<ProviderStreamChunk>,
    provider_session_id: Option<String>,
}

#[derive(Clone)]
pub struct ProviderStreamChunk {
    pub message_id: String,
    pub role: MessageRole,
    pub kind: ComposerStreamEventKind,
    pub chunk: String,
}

struct ProviderStreamResult {
    content: String,
    provider_session_id: Option<String>,
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

fn summarize_command(command: &str) -> String {
    let compact = command.split_whitespace().collect::<Vec<_>>().join(" ");
    let compact = compact.trim();
    if compact.is_empty() {
        return "调用工具".to_string();
    }
    let preview = if compact.chars().count() > 80 {
        format!("{}…", compact.chars().take(80).collect::<String>())
    } else {
        compact.to_string()
    };
    format!("调用工具: {preview}")
}

fn parse_claude_process_item(item: &Value) -> Option<ProviderStreamChunk> {
    let item_type = item.get("type").and_then(Value::as_str)?;
    match item_type {
        "thinking" | "redacted_thinking" => Some(ProviderStreamChunk {
            message_id: format!(
                "thinking-{}",
                item.get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("claude")
            ),
            role: MessageRole::System,
            kind: ComposerStreamEventKind::Status,
            chunk: "正在思考".to_string(),
        }),
        "tool_use" => {
            let name = item
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("工具");
            Some(ProviderStreamChunk {
                message_id: format!(
                    "tool-{}",
                    item.get("id")
                        .and_then(Value::as_str)
                        .unwrap_or(name)
                ),
                role: MessageRole::System,
                kind: ComposerStreamEventKind::ToolCall,
                chunk: format!("调用工具: {name}"),
            })
        }
        "tool_result" => Some(ProviderStreamChunk {
            message_id: format!(
                "tool-result-{}",
                item.get("tool_use_id")
                    .and_then(Value::as_str)
                    .unwrap_or("claude")
            ),
            role: MessageRole::System,
            kind: ComposerStreamEventKind::ToolResult,
            chunk: "工具调用已完成".to_string(),
        }),
        _ => None,
    }
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

fn escape_shell(value: &str) -> String {
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
    kind: ComposerStreamEventKind,
    delta: Option<String>,
    error: Option<String>,
    provider_session_id: Option<String>,
    message_id: Option<String>,
}

impl Default for ClaudeParsedLine {
    fn default() -> Self {
        Self {
            role: MessageRole::Assistant,
            kind: ComposerStreamEventKind::Message,
            delta: None,
            error: None,
            provider_session_id: None,
            message_id: None,
        }
    }
}
