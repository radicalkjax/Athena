#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
use commands::system_monitor::SystemMonitor;
use commands::wasm_runtime::WasmRuntime;
use std::sync::{Arc, Mutex};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SystemMonitor::new())
        .manage(Arc::new(Mutex::new(None::<WasmRuntime>)))
        .invoke_handler(tauri::generate_handler![
            commands::file_ops::upload_file,
            commands::file_ops::get_file_metadata,
            commands::file_ops::read_file_binary,
            commands::file_ops::write_file_binary,
            commands::file_ops::read_file_text,
            commands::file_ops::write_file_text,
            commands::system::get_system_status,
            commands::network::analyze_network_packet,
            commands::network::export_network_capture,
            commands::network::start_packet_capture,
            commands::network::stop_packet_capture,
            commands::system_monitor::get_cpu_info,
            commands::system_monitor::get_memory_info,
            commands::system_monitor::get_processes,
            commands::system_monitor::get_disk_info,
            commands::system_monitor::get_network_info,
            commands::system_monitor::get_system_stats,
            commands::system_monitor::kill_process,
            commands::disassembly::disassemble_file,
            commands::disassembly::get_control_flow_graph,
            commands::wasm_runtime::initialize_wasm_runtime,
            commands::wasm_runtime::load_wasm_module,
            commands::wasm_runtime::execute_wasm_function,
            commands::wasm_runtime::unload_wasm_module,
            commands::wasm_runtime::get_wasm_modules,
            commands::wasm_runtime::get_wasm_memory_usage,
            commands::ai_analysis::analyze_with_ai,
            commands::ai_analysis::get_ai_provider_status,
            commands::ai_analysis::update_ai_provider_config,
            commands::advanced_analysis::analyze_behavior,
            commands::advanced_analysis::run_yara_scan,
            commands::advanced_analysis::get_threat_intelligence,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // Dev tools can be opened manually if needed
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}