mod commands;
mod models;
mod providers;
mod secret_store;
mod seeded;
mod state;
mod storage;
mod store;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_dashboard_state,
            commands::get_provider_account_status,
            commands::inspect_provider_account_status,
            commands::get_available_skills,
            commands::create_project,
            commands::delete_project,
            commands::create_session,
            commands::delete_session,
            commands::save_provider_profile,
            commands::delete_provider_profile,
            commands::assign_pane_profile,
            commands::assign_pane_provider,
            commands::test_provider_profile,
            commands::launch_provider_login,
            commands::open_pane,
            commands::replace_pane_session,
            commands::close_pane,
            commands::focus_pane,
            commands::set_workspace_layout,
            commands::send_composer_message,
            commands::start_composer_stream,
            commands::retry_composer_stream,
            commands::cancel_pane_run,
            commands::get_remote_status,
            commands::toggle_remote_tunnel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
