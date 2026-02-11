mod commands;
mod scanner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::detect_file_types,
            commands::read_files_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
