use super::schema::{Job, WorkflowType};
use super::job_store::JobStore;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use std::path::Path;
use sha2::Digest;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProgressUpdate {
    pub job_id: String,
    pub progress: f64,
    pub message: String,
}

pub struct JobExecutor {
    store: Arc<JobStore>,
    progress_tx: mpsc::UnboundedSender<ProgressUpdate>,
    wasm_runtime: Arc<tokio::sync::Mutex<Option<crate::commands::wasm_runtime::WasmRuntime>>>,
    yara_state: Arc<tokio::sync::Mutex<crate::commands::yara_scanner::YaraState>>,
}

impl JobExecutor {
    pub fn new(
        store: Arc<JobStore>,
        progress_tx: mpsc::UnboundedSender<ProgressUpdate>,
        wasm_runtime: Arc<tokio::sync::Mutex<Option<crate::commands::wasm_runtime::WasmRuntime>>>,
        yara_state: Arc<tokio::sync::Mutex<crate::commands::yara_scanner::YaraState>>,
    ) -> Self {
        Self {
            store,
            progress_tx,
            wasm_runtime,
            yara_state,
        }
    }

    pub async fn execute_job(&self, job_id: String) -> Result<()> {
        // Get job
        let mut job = self.store.get_job(&job_id)?
            .ok_or_else(|| anyhow::anyhow!("Job not found: {}", job_id))?;

        // Mark as running
        let logs_before = job.logs.len();
        job.start();
        self.store.update_job(&job)?;
        // Persist new logs
        for log in &job.logs[logs_before..] {
            self.store.add_log(&job.id, log)?;
        }
        self.send_progress(&job.id, 0.0, "Starting job".to_string());

        // Execute based on workflow type
        let result = match job.workflow_type {
            WorkflowType::FileAnalysis => self.execute_file_analysis(&mut job).await,
            WorkflowType::BatchScan => self.execute_batch_scan(&mut job).await,
            WorkflowType::ThreatHunting => self.execute_threat_hunting(&mut job).await,
            WorkflowType::ReportGeneration => self.execute_report_generation(&mut job).await,
        };

        // Update final status
        let logs_before = job.logs.len();
        match result {
            Ok(output) => {
                job.complete(output);
                self.send_progress(&job.id, 1.0, "Job completed successfully".to_string());
            }
            Err(e) => {
                job.fail(e.to_string());
                self.send_progress(&job.id, 1.0, format!("Job failed: {}", e));
            }
        }

        self.store.update_job(&job)?;
        // Persist new logs
        for log in &job.logs[logs_before..] {
            self.store.add_log(&job.id, log)?;
        }

        Ok(())
    }

    async fn execute_file_analysis(&self, job: &mut Job) -> Result<serde_json::Value> {
        let start_time = std::time::Instant::now();

        // Extract file path from job input
        let file_path = job.input
            .get("file_path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing file_path in job input"))?
            .to_string();

        // Validate file exists
        if !Path::new(&file_path).exists() {
            return Err(anyhow::anyhow!("File not found: {}", file_path));
        }

        // Step 1: Read file and calculate basic info
        self.send_progress(&job.id, 0.1, "Reading file and calculating hashes".to_string());
        job.update_progress(0.1);
        self.store.update_job(&job)?;

        let file_data = tokio::fs::read(&file_path).await
            .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;

        let file_size = file_data.len();
        let md5_hash = format!("{:x}", md5::compute(&file_data));
        let sha256_hash = format!("{:x}", sha2::Sha256::digest(&file_data));

        // Step 2: Analyze file structure using file-processor module
        self.send_progress(&job.id, 0.3, "Analyzing binary structure".to_string());
        job.update_progress(0.3);
        self.store.update_job(&job)?;

        let file_analysis = crate::commands::file_analysis::analyze_file(file_path.clone())
            .await
            .map_err(|e| anyhow::anyhow!("File analysis failed: {}", e))?;

        // Step 3: Run YARA scanner
        self.send_progress(&job.id, 0.5, "Running YARA pattern matching".to_string());
        job.update_progress(0.5);
        self.store.update_job(&job)?;

        let yara_results = self.scan_file_with_yara(&file_path).await
            .unwrap_or_else(|e| crate::commands::yara_scanner::YaraScanResult {
                file_path: file_path.clone(),
                matches: vec![],
                scan_time_ms: 0,
                rules_loaded: 0,
                error: Some(e.to_string()),
            });

        // Step 4: Calculate entropy and detect anomalies
        self.send_progress(&job.id, 0.7, "Calculating entropy and detecting anomalies".to_string());
        job.update_progress(0.7);
        self.store.update_job(&job)?;

        let entropy = crate::commands::file_analysis::calculate_entropy(&file_data);
        let is_packed = entropy > 7.0;
        let has_high_entropy_sections = file_analysis.sections.iter()
            .any(|s| s.entropy > 7.2);

        // Step 5: Dynamic Analysis (sandbox execution if Docker available)
        self.send_progress(&job.id, 0.8, "Checking sandbox availability".to_string());
        job.update_progress(0.8);
        self.store.update_job(&job)?;

        let dynamic_analysis = self.execute_sandbox_analysis(&file_path).await;

        // Step 6: Determine threat level (combining static and dynamic analysis)
        self.send_progress(&job.id, 0.95, "Determining threat level".to_string());
        job.update_progress(0.95);
        self.store.update_job(&job)?;

        let yara_matches_count = yara_results.matches.len();
        let has_critical_matches = yara_results.matches.iter()
            .any(|m| m.meta.get("severity").map(|s| s.as_str()) == Some("critical"));
        let has_suspicious_imports = file_analysis.imports.iter()
            .any(|i| i.suspicious);

        // Factor in dynamic analysis results
        let dynamic_threat_indicators = dynamic_analysis.as_ref()
            .map(|da| da.behavioral_events.iter()
                .filter(|e| e.severity == "Critical" || e.severity == "High")
                .count())
            .unwrap_or(0);

        let has_mitre_attacks = dynamic_analysis.as_ref()
            .map(|da| !da.mitre_attacks.is_empty())
            .unwrap_or(false);

        let threat_level = if has_critical_matches || yara_matches_count >= 3 || dynamic_threat_indicators >= 3 {
            "critical"
        } else if yara_matches_count >= 1 || has_suspicious_imports || is_packed || has_mitre_attacks {
            "suspicious"
        } else if has_high_entropy_sections || dynamic_threat_indicators > 0 {
            "low"
        } else {
            "benign"
        };

        let malware_detected = threat_level == "critical" || threat_level == "suspicious";

        let analysis_time_ms = start_time.elapsed().as_millis() as u64;

        // Compile comprehensive results including dynamic analysis
        let dynamic_analysis_json = match &dynamic_analysis {
            Some(da) => serde_json::json!({
                "execution_successful": true,
                "exit_code": da.exit_code,
                "execution_time_ms": da.execution_time_ms,
                "behavioral_events": da.behavioral_events,
                "file_operations": da.file_operations,
                "network_connections": da.network_connections,
                "processes_created": da.processes_created,
                "syscall_summary": da.syscall_summary,
                "mitre_attacks": da.mitre_attacks,
            }),
            None => serde_json::json!({
                "execution_successful": false,
                "error": "Docker sandbox not available or execution failed",
                "note": "Static analysis results still available"
            }),
        };

        // Compile comprehensive results
        Ok(serde_json::json!({
            "status": "complete",
            "file_info": {
                "path": file_path,
                "size": file_size,
                "md5": md5_hash,
                "sha256": sha256_hash,
                "entropy": entropy,
            },
            "format_info": file_analysis.format_info,
            "sections": file_analysis.sections,
            "imports": file_analysis.imports,
            "exports": file_analysis.exports,
            "strings": file_analysis.strings.iter().take(100).collect::<Vec<_>>(),
            "yara_matches": yara_results.matches,
            "yara_rules_used": yara_results.rules_loaded,
            "dynamic_analysis": dynamic_analysis_json,
            "threat_assessment": {
                "threat_level": threat_level,
                "malware_detected": malware_detected,
                "is_packed": is_packed,
                "has_suspicious_imports": has_suspicious_imports,
                "dynamic_threat_indicators": dynamic_threat_indicators,
                "confidence": if malware_detected { 0.85 } else { 0.95 },
            },
            "signatures": file_analysis.signatures,
            "anomalies": file_analysis.anomalies,
            "analysis_time_ms": analysis_time_ms,
        }))
    }

    async fn execute_batch_scan(&self, job: &mut Job) -> Result<serde_json::Value> {
        let start_time = std::time::Instant::now();

        // Extract file paths from job input (clone to avoid borrow issues)
        let file_paths = job.input
            .get("file_paths")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow::anyhow!("Missing file_paths array in job input"))?
            .clone();

        let total_files = file_paths.len();
        let mut files_scanned = 0;
        let mut threats_found = 0;
        let mut scan_results = Vec::new();

        for (index, path_value) in file_paths.iter().enumerate() {
            let file_path = path_value.as_str()
                .ok_or_else(|| anyhow::anyhow!("Invalid file path at index {}", index))?;

            // Update progress
            let progress = (index as f64) / (total_files as f64);
            self.send_progress(&job.id, progress, format!("Scanning file {}/{}: {}", index + 1, total_files, file_path));
            job.update_progress(progress);
            self.store.update_job(&job)?;

            // Skip if file doesn't exist
            if !Path::new(file_path).exists() {
                scan_results.push(serde_json::json!({
                    "file_path": file_path,
                    "status": "error",
                    "error": "File not found"
                }));
                continue;
            }

            // Scan with YARA
            match self.scan_file_with_yara(file_path).await {
                Ok(result) => {
                    files_scanned += 1;
                    let has_threats = !result.matches.is_empty();
                    if has_threats {
                        threats_found += 1;
                    }

                    scan_results.push(serde_json::json!({
                        "file_path": file_path,
                        "status": "scanned",
                        "matches": result.matches.len(),
                        "threat_detected": has_threats,
                        "scan_time_ms": result.scan_time_ms,
                    }));
                }
                Err(e) => {
                    scan_results.push(serde_json::json!({
                        "file_path": file_path,
                        "status": "error",
                        "error": e.to_string()
                    }));
                }
            }
        }

        let analysis_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(serde_json::json!({
            "status": "complete",
            "files_scanned": files_scanned,
            "threats_found": threats_found,
            "total_files": total_files,
            "results": scan_results,
            "analysis_time_ms": analysis_time_ms,
        }))
    }

    async fn execute_threat_hunting(&self, job: &mut Job) -> Result<serde_json::Value> {
        let start_time = std::time::Instant::now();

        // Extract search directory from job input
        let search_dir = job.input
            .get("directory")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing directory in job input"))?
            .to_string();

        let search_path = Path::new(&search_dir);
        if !search_path.exists() || !search_path.is_dir() {
            return Err(anyhow::anyhow!("Invalid directory: {}", search_dir));
        }

        // Get file patterns to search for
        let patterns = job.input
            .get("patterns")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| vec!["*.exe".to_string(), "*.dll".to_string(), "*.sys".to_string()]);

        self.send_progress(&job.id, 0.2, format!("Scanning directory: {}", search_dir));
        job.update_progress(0.2);
        self.store.update_job(&job)?;

        // Recursively find files matching patterns
        let mut files_to_scan = Vec::new();
        for pattern in &patterns {
            // Simple recursive directory walk
            if let Ok(mut entries) = tokio::fs::read_dir(&search_path).await {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Ok(file_type) = entry.file_type().await {
                        let path = entry.path();
                        if file_type.is_file() {
                            // Check if file matches pattern (simple extension matching)
                            let ext = pattern.trim_start_matches("*.");
                            if let Some(file_ext) = path.extension() {
                                if file_ext == ext {
                                    files_to_scan.push(path);
                                }
                            }
                        } else if file_type.is_dir() {
                            // Recursively scan subdirectories (simplified - only one level for now)
                            if let Ok(mut sub_entries) = tokio::fs::read_dir(&path).await {
                                while let Ok(Some(sub_entry)) = sub_entries.next_entry().await {
                                    if let Ok(sub_file_type) = sub_entry.file_type().await {
                                        if sub_file_type.is_file() {
                                            let sub_path = sub_entry.path();
                                            let ext = pattern.trim_start_matches("*.");
                                            if let Some(file_ext) = sub_path.extension() {
                                                if file_ext == ext {
                                                    files_to_scan.push(sub_path);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        self.send_progress(&job.id, 0.4, format!("Found {} files to analyze", files_to_scan.len()));
        job.update_progress(0.4);
        self.store.update_job(&job)?;

        // Scan each file
        let mut threats_found = Vec::new();
        let total_files = files_to_scan.len();

        for (index, file_path) in files_to_scan.iter().enumerate() {
            let progress = 0.4 + (0.5 * (index as f64 / total_files as f64));
            self.send_progress(
                &job.id,
                progress,
                format!("Scanning {}/{}: {}", index + 1, total_files, file_path.display())
            );
            job.update_progress(progress);
            self.store.update_job(&job)?;

            // Scan with YARA
            if let Ok(result) = self.scan_file_with_yara(&file_path.to_string_lossy()).await {
                if !result.matches.is_empty() {
                    threats_found.push(serde_json::json!({
                        "file_path": file_path.to_string_lossy(),
                        "matches": result.matches,
                        "threat_level": if result.matches.iter().any(|m|
                            m.meta.get("severity").map(|s| s.as_str()) == Some("critical")
                        ) { "critical" } else if result.matches.len() > 2 { "high" } else { "medium" },
                    }));
                }
            }
        }

        let analysis_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(serde_json::json!({
            "status": "complete",
            "directory": search_dir,
            "files_scanned": total_files,
            "threats_found": threats_found,
            "threat_count": threats_found.len(),
            "analysis_time_ms": analysis_time_ms,
        }))
    }

    async fn execute_report_generation(&self, job: &mut Job) -> Result<serde_json::Value> {
        let start_time = std::time::Instant::now();

        // Extract report parameters from job input (clone to avoid borrow issues)
        let report_data = job.input
            .get("data")
            .ok_or_else(|| anyhow::anyhow!("Missing report data in job input"))?
            .clone();

        let format = job.input
            .get("format")
            .and_then(|v| v.as_str())
            .unwrap_or("pdf")
            .to_string();

        let file_name = job.input
            .get("file_name")
            .and_then(|v| v.as_str())
            .unwrap_or("athena_report")
            .to_string();

        self.send_progress(&job.id, 0.3, format!("Preparing {} report data", format));
        job.update_progress(0.3);
        self.store.update_job(&job)?;

        // Generate a temporary directory for reports
        let temp_dir = std::env::temp_dir().join("athena_reports");
        tokio::fs::create_dir_all(&temp_dir).await
            .map_err(|e| anyhow::anyhow!("Failed to create reports directory: {}", e))?;

        let output_path = match format.as_str() {
            "pdf" => {
                self.send_progress(&job.id, 0.5, "Generating PDF report".to_string());
                job.update_progress(0.5);
                self.store.update_job(&job)?;

                let path = temp_dir.join(format!("{}.pdf", file_name));
                crate::commands::file_analysis::generate_pdf_report(
                    report_data.clone(),
                    path.to_string_lossy().to_string()
                ).await
                .map_err(|e| anyhow::anyhow!("PDF generation failed: {}", e))?;
                path
            }
            "html" => {
                self.send_progress(&job.id, 0.5, "Generating HTML report".to_string());
                job.update_progress(0.5);
                self.store.update_job(&job)?;

                let path = temp_dir.join(format!("{}.html", file_name));
                // Use the internal HTML generation function
                self.generate_html_report(report_data.clone(), path.to_string_lossy().to_string())
                    .await?;
                path
            }
            "xlsx" | "excel" => {
                self.send_progress(&job.id, 0.5, "Generating Excel report".to_string());
                job.update_progress(0.5);
                self.store.update_job(&job)?;

                let path = temp_dir.join(format!("{}.xlsx", file_name));
                crate::commands::file_analysis::generate_excel_report(
                    report_data.clone(),
                    path.to_string_lossy().to_string()
                ).await
                .map_err(|e| anyhow::anyhow!("Excel generation failed: {}", e))?;
                path
            }
            _ => {
                return Err(anyhow::anyhow!("Unsupported report format: {}", format));
            }
        };

        self.send_progress(&job.id, 0.9, "Finalizing report".to_string());
        job.update_progress(0.9);
        self.store.update_job(&job)?;

        // Get file size
        let file_size = tokio::fs::metadata(&output_path).await
            .map(|m| m.len())
            .unwrap_or(0);

        let analysis_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(serde_json::json!({
            "status": "complete",
            "report_path": output_path.to_string_lossy(),
            "format": format,
            "file_size": file_size,
            "file_name": file_name,
            "analysis_time_ms": analysis_time_ms,
        }))
    }

    async fn generate_html_report(&self, data: serde_json::Value, output_path: String) -> Result<()> {
        let _metadata = data.get("metadata").cloned().unwrap_or(serde_json::json!({}));
        let sections = data.get("sections").cloned().unwrap_or(serde_json::json!({}));

        let html = format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Athena Workflow Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #1a1a2e; color: #eee; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #ff69b4; border-bottom: 2px solid #ff69b4; padding-bottom: 10px; }}
        h2 {{ color: #00d4ff; margin-top: 30px; }}
        .metadata {{ background: #16213e; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
        .section {{ background: #16213e; padding: 20px; border-radius: 8px; margin-bottom: 15px; }}
        pre {{ background: #0f0f23; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Athena Workflow Analysis Report</h1>
        <div class="metadata">
            <p><strong>Generated:</strong> {}</p>
        </div>
        <h2>Results</h2>
        <div class="section">
            <pre>{}</pre>
        </div>
    </div>
</body>
</html>"#,
            chrono::Utc::now().to_rfc3339(),
            serde_json::to_string_pretty(&sections).unwrap_or_default()
        );

        tokio::fs::write(&output_path, html).await
            .map_err(|e| anyhow::anyhow!("Failed to write HTML report: {}", e))?;

        Ok(())
    }

    fn send_progress(&self, job_id: &str, progress: f64, message: String) {
        let _ = self.progress_tx.send(ProgressUpdate {
            job_id: job_id.to_string(),
            progress,
            message,
        });
    }

    /// Helper method to scan a file with YARA, handling initialization if needed
    async fn scan_file_with_yara(&self, file_path: &str) -> Result<crate::commands::yara_scanner::YaraScanResult> {
        use std::collections::HashMap;

        let start = std::time::Instant::now();

        // Lock the YARA state
        let mut yara_state = self.yara_state.lock().await;

        // Initialize YARA rules if not already done
        if yara_state.rules.is_none() {
            let mut compiler = yara_x::Compiler::new();

            // Add default rules (same as in yara_scanner.rs initialize_yara_scanner)
            let default_rules = include_str!("../commands/yara_scanner.rs")
                .lines()
                .skip_while(|l| !l.contains("let default_rules = r#\""))
                .skip(1)
                .take_while(|l| !l.contains("\"#;"))
                .collect::<Vec<_>>()
                .join("\n");

            // Fallback to basic rules if extraction fails
            let rules_content = if default_rules.trim().is_empty() {
                r#"
rule Suspicious_Executable {
    meta:
        description = "Detects suspicious executable patterns"
        severity = "medium"
    strings:
        $mz = { 4D 5A }
        $pe = "PE\x00\x00"
    condition:
        $mz at 0 and $pe
}
                "#
            } else {
                default_rules.as_str()
            };

            compiler.add_source(rules_content)
                .map_err(|e| anyhow::anyhow!("Failed to compile YARA rules: {}", e))?;

            let rules = compiler.build();
            let rules_count = self.count_yara_rules(&rules);

            yara_state.rules = Some(rules);
            yara_state.rules_count = rules_count;
        }

        // Get the compiled rules
        let rules = yara_state.rules.as_ref()
            .ok_or_else(|| anyhow::anyhow!("YARA rules not initialized"))?;

        let rules_loaded = yara_state.rules_count;

        // Read file
        let data = std::fs::read(file_path)
            .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;

        // Create scanner with compiled rules
        let mut scanner = yara_x::Scanner::new(rules);

        // Scan the data
        let scan_results = scanner.scan(&data)
            .map_err(|e| anyhow::anyhow!("Scan failed: {}", e))?;

        let scan_time_ms = start.elapsed().as_millis() as u64;

        // Convert YARA-X results to our format
        let mut matches = Vec::new();

        for rule in scan_results.matching_rules() {
            let mut meta = HashMap::new();

            // Extract metadata
            for (key, value) in rule.metadata() {
                let value_str = match value {
                    yara_x::MetaValue::Integer(i) => i.to_string(),
                    yara_x::MetaValue::Float(f) => f.to_string(),
                    yara_x::MetaValue::Bool(b) => b.to_string(),
                    yara_x::MetaValue::String(s) => s.to_string(),
                    yara_x::MetaValue::Bytes(b) => format!("{:?}", b),
                };
                meta.insert(key.to_string(), value_str);
            }

            // Extract matched strings
            let mut strings = Vec::new();
            for pattern in rule.patterns() {
                for m in pattern.matches() {
                    let range = m.range();
                    let matched_bytes = m.data();

                    strings.push(crate::commands::yara_scanner::YaraStringMatch {
                        identifier: pattern.identifier().to_string(),
                        offset: range.start as u64,
                        length: matched_bytes.len(),
                        matched_data: String::from_utf8(matched_bytes.to_vec()).ok(),
                    });
                }
            }

            matches.push(crate::commands::yara_scanner::YaraMatch {
                rule_name: rule.identifier().to_string(),
                namespace: Some(rule.namespace().to_string()),
                tags: vec![],
                meta,
                strings,
            });
        }

        Ok(crate::commands::yara_scanner::YaraScanResult {
            file_path: file_path.to_string(),
            matches,
            scan_time_ms,
            rules_loaded,
            error: None,
        })
    }

    /// Helper to count rules in a compiled Rules object
    fn count_yara_rules(&self, rules: &yara_x::Rules) -> usize {
        let mut scanner = yara_x::Scanner::new(rules);
        match scanner.scan(&[]) {
            Ok(scan_results) => {
                let matching_count = scan_results.matching_rules().count();
                let non_matching_count = scan_results.non_matching_rules().count();
                matching_count + non_matching_count
            }
            Err(_) => 0,
        }
    }

    /// Execute sandbox analysis if Docker is available
    async fn execute_sandbox_analysis(&self, file_path: &str) -> Option<crate::sandbox::ExecutionReport> {
        use crate::sandbox::{SandboxOrchestrator, SandboxConfig, OsType};
        use std::time::Duration;

        // Check if Docker is available
        if !SandboxOrchestrator::is_docker_available().await {
            eprintln!("[Workflow] Docker sandbox not available, skipping dynamic analysis");
            return None;
        }

        // Create orchestrator
        let orchestrator = match SandboxOrchestrator::new().await {
            Ok(o) => o,
            Err(e) => {
                eprintln!("[Workflow] Failed to create sandbox orchestrator: {}", e);
                return None;
            }
        };

        // Configure sandbox
        let config = SandboxConfig {
            os_type: OsType::Linux,
            timeout: Duration::from_secs(60), // 1 minute timeout for workflow
            capture_network: true,
            capture_screenshots: false,
            memory_limit: 256 * 1024 * 1024, // 256MB for workflow
        };

        // Execute sample
        match orchestrator.execute_sample(std::path::PathBuf::from(file_path), config).await {
            Ok(report) => {
                println!("[Workflow] Sandbox analysis complete: {} behavioral events, {} MITRE attacks",
                    report.behavioral_events.len(), report.mitre_attacks.len());
                Some(report)
            }
            Err(e) => {
                eprintln!("[Workflow] Sandbox execution failed: {}", e);
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    fn create_test_job(workflow_type: WorkflowType, input: serde_json::Value) -> Job {
        Job {
            id: uuid::Uuid::new_v4().to_string(),
            workflow_type,
            input,
            status: super::super::schema::JobStatus::Pending,
            progress: 0.0,
            created_at: chrono::Utc::now(),
            started_at: None,
            completed_at: None,
            output: None,
            error: None,
            logs: Vec::new(),
        }
    }

    #[test]
    fn test_progress_update_creation() {
        let update = ProgressUpdate {
            job_id: "test-123".to_string(),
            progress: 0.5,
            message: "Processing...".to_string(),
        };

        assert_eq!(update.job_id, "test-123");
        assert_eq!(update.progress, 0.5);
        assert_eq!(update.message, "Processing...");
    }

    #[tokio::test]
    async fn test_create_html_report() {
        let (_tx, _rx) = mpsc::unbounded_channel();
        let job_store = Arc::new(JobStore::new(":memory:").unwrap());
        let wasm_runtime = Arc::new(tokio::sync::Mutex::new(None));
        let yara_state = Arc::new(tokio::sync::Mutex::new(
            crate::commands::yara_scanner::YaraState {
                rules: None,
                rules_count: 0,
            }
        ));

        let executor = JobExecutor::new(
            job_store,
            _tx,
            wasm_runtime,
            yara_state,
        );

        let report_data = serde_json::json!({
            "metadata": {
                "fileName": "test.exe",
                "analysisDate": "2025-01-01"
            },
            "sections": {
                "summary": "Test report"
            }
        });

        let temp_dir = std::env::temp_dir();
        let output_path = temp_dir.join("test_report.html").to_string_lossy().to_string();

        let result = executor.generate_html_report(report_data, output_path.clone()).await;
        assert!(result.is_ok());

        // Verify file was created
        assert!(std::path::Path::new(&output_path).exists());

        // Clean up
        let _ = std::fs::remove_file(&output_path);
    }

    #[test]
    fn test_file_analysis_job_creation() {
        let input = serde_json::json!({
            "file_path": "/tmp/test.exe"
        });

        let job = create_test_job(WorkflowType::FileAnalysis, input);

        assert!(matches!(job.workflow_type, WorkflowType::FileAnalysis));
        assert_eq!(job.input.get("file_path").and_then(|v| v.as_str()), Some("/tmp/test.exe"));
        assert!(matches!(job.status, super::super::schema::JobStatus::Pending));
        assert_eq!(job.progress, 0.0);
    }

    #[test]
    fn test_batch_scan_job_creation() {
        let input = serde_json::json!({
            "file_paths": ["/tmp/file1.exe", "/tmp/file2.dll"]
        });

        let job = create_test_job(WorkflowType::BatchScan, input);

        assert!(matches!(job.workflow_type, WorkflowType::BatchScan));
        let paths = job.input.get("file_paths").and_then(|v| v.as_array());
        assert!(paths.is_some());
        assert_eq!(paths.unwrap().len(), 2);
    }

    #[test]
    fn test_threat_hunting_job_creation() {
        let input = serde_json::json!({
            "directory": "/var/log",
            "patterns": ["*.exe", "*.dll"]
        });

        let job = create_test_job(WorkflowType::ThreatHunting, input);

        assert!(matches!(job.workflow_type, WorkflowType::ThreatHunting));
        assert_eq!(job.input.get("directory").and_then(|v| v.as_str()), Some("/var/log"));
    }

    #[test]
    fn test_report_generation_job_creation() {
        let input = serde_json::json!({
            "format": "pdf",
            "file_name": "report",
            "data": {
                "results": "test"
            }
        });

        let job = create_test_job(WorkflowType::ReportGeneration, input);

        assert!(matches!(job.workflow_type, WorkflowType::ReportGeneration));
        assert_eq!(job.input.get("format").and_then(|v| v.as_str()), Some("pdf"));
    }

    #[test]
    fn test_send_progress() {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let job_store = Arc::new(JobStore::new(":memory:").unwrap());
        let wasm_runtime = Arc::new(tokio::sync::Mutex::new(None));
        let yara_state = Arc::new(tokio::sync::Mutex::new(
            crate::commands::yara_scanner::YaraState {
                rules: None,
                rules_count: 0,
            }
        ));

        let executor = JobExecutor::new(
            job_store,
            tx,
            wasm_runtime,
            yara_state,
        );

        executor.send_progress("job-123", 0.75, "Almost done".to_string());

        // Verify progress was sent
        let progress = rx.try_recv();
        assert!(progress.is_ok());

        let update = progress.unwrap();
        assert_eq!(update.job_id, "job-123");
        assert_eq!(update.progress, 0.75);
        assert_eq!(update.message, "Almost done");
    }

    #[test]
    fn test_count_yara_rules() {
        let (tx, _rx) = mpsc::unbounded_channel();
        let job_store = Arc::new(JobStore::new(":memory:").unwrap());
        let wasm_runtime = Arc::new(tokio::sync::Mutex::new(None));
        let yara_state = Arc::new(tokio::sync::Mutex::new(
            crate::commands::yara_scanner::YaraState {
                rules: None,
                rules_count: 0,
            }
        ));

        let executor = JobExecutor::new(
            job_store,
            tx,
            wasm_runtime,
            yara_state,
        );

        // Create a simple YARA rule
        let mut compiler = yara_x::Compiler::new();
        compiler.add_source(r#"
            rule test_rule {
                strings:
                    $test = "test"
                condition:
                    $test
            }
        "#).unwrap();

        let rules = compiler.build();
        let count = executor.count_yara_rules(&rules);

        assert_eq!(count, 1);
    }
}
