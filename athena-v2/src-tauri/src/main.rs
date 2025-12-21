#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod ai_providers;
mod signature_verify;
mod workflow;
mod threat_intel;
mod api_server;
mod cache;
mod metrics;
mod sandbox;
use commands::system_monitor::SystemMonitor;
use commands::wasm_runtime::WasmRuntime;
use commands::yara_scanner::YaraState;
use workflow::JobStore;
use std::sync::{Arc, Mutex};
use tauri::Manager;

fn main() {
    // Initialize job store
    let job_store = Arc::new(
        JobStore::new("jobs.db")
            .expect("Failed to initialize job store")
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SystemMonitor::new())
        .manage(Arc::new(Mutex::new(None::<WasmRuntime>)))
        .manage(Arc::new(Mutex::new(YaraState::new())))
        .manage(job_store)
        .invoke_handler(tauri::generate_handler![
            commands::file_ops::upload_file,
            commands::file_ops::get_file_metadata,
            commands::file_ops::read_file_binary,
            commands::file_ops::write_file_binary,
            commands::file_ops::read_file_text,
            commands::file_ops::write_file_text,
            commands::file_ops::create_temp_file,
            commands::system::get_system_status,
            commands::network::analyze_network_packet,
            commands::network::export_network_capture,
            commands::network::start_packet_capture,
            commands::network::stop_packet_capture,
            commands::network::get_active_captures,
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
            commands::wasm_runtime::load_wasm_module_from_file,
            commands::wasm_runtime::execute_wasm_function,
            commands::wasm_runtime::unload_wasm_module,
            commands::wasm_runtime::get_wasm_modules,
            commands::wasm_runtime::get_wasm_memory_usage,
            commands::wasm_runtime::get_wasm_metrics,
            commands::wasm_runtime::get_all_wasm_metrics,
            commands::wasm_runtime::reset_wasm_metrics,
            commands::wasm_runtime::reset_all_wasm_metrics,
            // Session-based WASM execution for resource management
            commands::wasm_runtime::create_wasm_session,
            commands::wasm_runtime::execute_session_function,
            commands::wasm_runtime::destroy_wasm_session,
            commands::wasm_runtime::list_wasm_sessions,
            commands::wasm_runtime::get_session_info,
            commands::wasm_runtime::drop_session_resource,
            commands::ai_analysis::analyze_with_ai,
            commands::ai_analysis::get_ai_provider_status,
            commands::ai_analysis::update_ai_provider_config,
            commands::ai_analysis::get_ai_provider_config,
            commands::ai_analysis::list_ai_provider_configs,
            commands::ai_analysis::clear_ai_cache,
            commands::ai_analysis::get_cache_stats,
            commands::ai_analysis::cleanup_cache,
            commands::ai_analysis::cache_key_exists,
            metrics::push_metrics_to_gateway,
            commands::advanced_analysis::analyze_behavior,
            commands::advanced_analysis::get_threat_intelligence,
            commands::file_analysis::analyze_file,
            commands::wasm_file_bridge::analyze_file_with_wasm,
            commands::wasm_file_bridge::load_wasm_security_modules,
            commands::yara_scanner::initialize_yara_scanner,
            commands::yara_scanner::load_yara_rules,
            commands::yara_scanner::load_default_yara_rules,
            commands::yara_scanner::scan_file_with_yara,
            commands::yara_scanner::get_yara_rule_sets,
            commands::file_analysis::generate_pdf_report,
            commands::file_analysis::generate_excel_report,
            commands::file_analysis::generate_report,
            commands::file_analysis::encrypt_export_data,
            commands::file_analysis::compress_export_data,
            // Frontend logging commands
            commands::logging::log_frontend_message,
            commands::logging::log_frontend_error,
            commands::workflow::start_job,
            commands::workflow::get_job_status,
            commands::workflow::list_jobs,
            commands::workflow::cancel_job,
            commands::workflow::delete_job,
            commands::workflow::get_active_jobs,
            // Container management commands
            commands::container::check_docker_available,
            commands::container::create_sandbox_container,
            commands::container::execute_in_container,
            commands::container::stop_container,
            commands::container::remove_container,
            commands::container::list_sandbox_containers,
            commands::container::get_container_logs,
            // Sandbox execution commands
            commands::sandbox_commands::check_sandbox_available,
            commands::sandbox_commands::execute_sample_in_sandbox,
            commands::sandbox_commands::execute_sample_with_config,
            commands::sandbox_commands::get_sandbox_status,
            // Sandbox analysis utilities
            commands::sandbox_commands::filter_behavioral_events,
            commands::sandbox_commands::summarize_file_operations,
            commands::sandbox_commands::analyze_network_connections,
            commands::sandbox_commands::get_process_tree,
            commands::sandbox_commands::get_mitre_attack_details,
            commands::sandbox_commands::format_sandbox_error,
            commands::sandbox_commands::calculate_threat_score,
            // Volatility memory forensics
            commands::sandbox_commands::analyze_memory_with_volatility,
            commands::sandbox_commands::check_volatility_available,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // Dev tools can be opened manually if needed
            }

            // Initialize WASM runtime on startup using AppHandle
            let init_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                println!("Initializing WASM runtime...");
                match crate::commands::wasm_runtime::initialize_wasm_runtime(
                    init_handle.state()
                ).await {
                    Ok(msg) => println!("{}", msg),
                    Err(e) => eprintln!("Failed to initialize WASM runtime: {}", e),
                }

                // Load security modules
                println!("Loading WASM security modules...");
                match crate::commands::wasm_file_bridge::load_wasm_security_modules(
                    init_handle.state()
                ).await {
                    Ok(modules) => println!("Loaded {} WASM modules: {:?}", modules.len(), modules),
                    Err(e) => eprintln!("Failed to load WASM modules: {}", e),
                }
            });

            // Start embedded API server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                println!("Starting API server on port 3000...");
                if let Err(e) = api_server::start_api_server(app_handle, 3000).await {
                    eprintln!("API server error: {}", e);
                }
            });

            // Optional: Push metrics to Pushgateway periodically (per DeepWiki for desktop apps)
            // Uncomment if you have a Pushgateway running
            /*
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                    if let Err(e) = metrics::push_to_gateway("athena-desktop", "http://localhost:9091") {
                        eprintln!("Failed to push metrics: {}", e);
                    }
                }
            });
            */

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}