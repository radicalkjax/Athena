use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct BehavioralAnalysis {
    id: String,
    timestamp: u64,
    behaviors: Vec<BehaviorPattern>,
    risk_score: u32,
    sandbox_escape: bool,
    persistence: Vec<PersistenceMechanism>,
    network_activity: Vec<NetworkBehavior>,
    file_operations: Vec<FileOperation>,
    process_activity: Vec<ProcessBehavior>,
    registry_modifications: Vec<RegistryChange>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BehaviorPattern {
    r#type: String,
    description: String,
    severity: String,
    confidence: f32,
    evidence: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PersistenceMechanism {
    technique: String,
    location: String,
    details: String,
    mitre_technique: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkBehavior {
    r#type: String,
    destination: String,
    port: u16,
    protocol: String,
    data: Option<String>,
    suspicious: bool,
    timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperation {
    operation: String,
    path: String,
    process: String,
    timestamp: u64,
    suspicious: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessBehavior {
    operation: String,
    process_name: String,
    pid: u32,
    parent_pid: Option<u32>,
    command_line: Option<String>,
    suspicious: bool,
    timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistryChange {
    operation: String,
    key: String,
    value: Option<String>,
    data: Option<String>,
    process: String,
    suspicious: bool,
    timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YaraMatch {
    rule: String,
    namespace: Option<String>,
    tags: Vec<String>,
    meta: HashMap<String, String>,
    strings: Vec<YaraString>,
    confidence: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YaraString {
    identifier: String,
    offset: u64,
    value: String,
    length: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreatIntelligence {
    source: String,
    timestamp: u64,
    indicators: Vec<ThreatIndicator>,
    malware_family: Option<String>,
    campaigns: Option<Vec<String>>,
    actors: Option<Vec<String>>,
    ttps: Option<Vec<String>>,
    references: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreatIndicator {
    r#type: String,
    value: String,
    confidence: f32,
    first_seen: Option<u64>,
    last_seen: Option<u64>,
    tags: Vec<String>,
}

#[command]
pub async fn analyze_behavior(
    runtime: tauri::State<'_, std::sync::Arc<std::sync::Mutex<Option<crate::commands::wasm_runtime::WasmRuntime>>>>,
    file_hash: String,
    file_data: Vec<u8>,
) -> Result<BehavioralAnalysis, String> {
    use crate::commands::wasm_runtime;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    // Execute sandbox WASM module for behavioral analysis
    let args = vec![serde_json::json!(file_data)];

    let result = wasm_runtime::execute_wasm_function(
        runtime,
        "sandbox".to_string(),
        "sandbox#analyze".to_string(),
        args,
    )
    .await
    .map_err(|e| format!("Sandbox analysis failed: {}", e))?;

    if !result.success {
        return Err(result.error.unwrap_or("Behavioral analysis failed".to_string()));
    }

    // Parse sandbox output
    let output_str = result.output.as_ref()
        .ok_or("No output from sandbox")?;
    let sandbox_result: serde_json::Value = serde_json::from_str(output_str)
        .map_err(|e| format!("Failed to parse sandbox output: {}", e))?;

    // Extract behaviors from sandbox output
    let mut behaviors = Vec::new();
    if let Some(behavior_array) = sandbox_result["behaviors"].as_array() {
        for behavior in behavior_array {
            behaviors.push(BehaviorPattern {
                r#type: behavior["type"].as_str().unwrap_or("unknown").to_string(),
                description: behavior["description"].as_str().unwrap_or("").to_string(),
                severity: behavior["severity"].as_str().unwrap_or("medium").to_string(),
                confidence: behavior["confidence"].as_f64().unwrap_or(0.5) as f32,
                evidence: behavior["evidence"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
            });
        }
    }

    // Extract network activity
    let mut network_activity = Vec::new();
    if let Some(network_array) = sandbox_result["network_activity"].as_array() {
        for net in network_array {
            network_activity.push(NetworkBehavior {
                r#type: net["type"].as_str().unwrap_or("unknown").to_string(),
                destination: net["destination"].as_str().unwrap_or("").to_string(),
                port: net["port"].as_u64().unwrap_or(0) as u16,
                protocol: net["protocol"].as_str().unwrap_or("TCP").to_string(),
                data: net["data"].as_str().map(|s| s.to_string()),
                suspicious: net["suspicious"].as_bool().unwrap_or(false),
                timestamp: net["timestamp"].as_u64().unwrap_or(timestamp),
            });
        }
    }

    // Extract file operations
    let mut file_operations = Vec::new();
    if let Some(file_array) = sandbox_result["file_operations"].as_array() {
        for file_op in file_array {
            file_operations.push(FileOperation {
                operation: file_op["operation"].as_str().unwrap_or("").to_string(),
                path: file_op["path"].as_str().unwrap_or("").to_string(),
                process: file_op["process"].as_str().unwrap_or("").to_string(),
                timestamp: file_op["timestamp"].as_u64().unwrap_or(timestamp),
                suspicious: file_op["suspicious"].as_bool().unwrap_or(false),
            });
        }
    }

    // Extract process activity
    let mut process_activity = Vec::new();
    if let Some(proc_array) = sandbox_result["process_activity"].as_array() {
        for proc in proc_array {
            process_activity.push(ProcessBehavior {
                operation: proc["operation"].as_str().unwrap_or("").to_string(),
                process_name: proc["process_name"].as_str().unwrap_or("").to_string(),
                pid: proc["pid"].as_u64().unwrap_or(0) as u32,
                parent_pid: proc["parent_pid"].as_u64().map(|p| p as u32),
                command_line: proc["command_line"].as_str().map(|s| s.to_string()),
                suspicious: proc["suspicious"].as_bool().unwrap_or(false),
                timestamp: proc["timestamp"].as_u64().unwrap_or(timestamp),
            });
        }
    }

    // Extract persistence mechanisms
    let mut persistence = Vec::new();
    if let Some(persist_array) = sandbox_result["persistence"].as_array() {
        for persist in persist_array {
            persistence.push(PersistenceMechanism {
                technique: persist["technique"].as_str().unwrap_or("").to_string(),
                location: persist["location"].as_str().unwrap_or("").to_string(),
                details: persist["details"].as_str().unwrap_or("").to_string(),
                mitre_technique: persist["mitre_technique"].as_str().map(|s| s.to_string()),
            });
        }
    }

    // Extract registry modifications
    let mut registry_modifications = Vec::new();
    if let Some(reg_array) = sandbox_result["registry_modifications"].as_array() {
        for reg in reg_array {
            registry_modifications.push(RegistryChange {
                operation: reg["operation"].as_str().unwrap_or("").to_string(),
                key: reg["key"].as_str().unwrap_or("").to_string(),
                value: reg["value"].as_str().map(|s| s.to_string()),
                data: reg["data"].as_str().map(|s| s.to_string()),
                process: reg["process"].as_str().unwrap_or("").to_string(),
                suspicious: reg["suspicious"].as_bool().unwrap_or(false),
                timestamp: reg["timestamp"].as_u64().unwrap_or(timestamp),
            });
        }
    }

    let risk_score = sandbox_result["risk_score"].as_u64().unwrap_or(0) as u32;
    let sandbox_escape = sandbox_result["sandbox_escape"].as_bool().unwrap_or(false);

    Ok(BehavioralAnalysis {
        id: file_hash,
        timestamp,
        behaviors,
        risk_score,
        sandbox_escape,
        persistence,
        network_activity,
        file_operations,
        process_activity,
        registry_modifications,
    })
}

// YARA scanning is now handled by yara_scanner.rs
// Uses yara-x for full YARA rule support with compilation and persistent state

#[command]
pub async fn get_threat_intelligence(
    file_hash: String,
    iocs: Vec<String>,
) -> Result<Vec<ThreatIntelligence>, String> {
    use crate::threat_intel::stix_parser;

    // Load threat intelligence from MITRE ATT&CK STIX feed
    let mitre_intel = stix_parser::load_mitre_attack_stix()
        .await
        .map_err(|e| format!("Failed to load MITRE ATT&CK data: {}", e))?;

    // Create a set of all IOCs to search for (including file hash)
    let mut search_indicators: std::collections::HashSet<String> = iocs.iter().cloned().collect();
    if !file_hash.is_empty() {
        search_indicators.insert(file_hash.to_lowercase());
    }

    // Filter threat intelligence based on matching indicators
    let threat_intel: Vec<ThreatIntelligence> = mitre_intel
        .into_iter()
        .filter_map(|intel| {
            // Check if any indicators match our IOCs
            let has_matching_indicator = intel.indicators.iter().any(|ind| {
                search_indicators.contains(&ind.value.to_lowercase()) ||
                search_indicators.iter().any(|ioc| {
                    ind.value.to_lowercase().contains(&ioc.to_lowercase()) ||
                    ioc.to_lowercase().contains(&ind.value.to_lowercase())
                })
            });

            // Check if malware family matches any IOC
            let has_matching_malware = intel.malware_family.as_ref().map_or(false, |family| {
                search_indicators.iter().any(|ioc| {
                    family.to_lowercase().contains(&ioc.to_lowercase()) ||
                    ioc.to_lowercase().contains(&family.to_lowercase())
                })
            });

            // Check if any TTP contains matching keywords
            let has_matching_ttp = intel.ttps.iter().any(|ttp| {
                search_indicators.iter().any(|ioc| {
                    ttp.to_lowercase().contains(&ioc.to_lowercase())
                })
            });

            // If we have no search indicators, return all threat intel (for general threat landscape)
            // Otherwise, only return matches
            if search_indicators.is_empty() || has_matching_indicator || has_matching_malware || has_matching_ttp {
                Some(ThreatIntelligence {
                    source: intel.source,
                    timestamp: intel.timestamp,
                    indicators: intel
                        .indicators
                        .into_iter()
                        .map(|ind| ThreatIndicator {
                            r#type: ind.indicator_type,
                            value: ind.value,
                            confidence: ind.confidence,
                            first_seen: ind.first_seen,
                            last_seen: ind.last_seen,
                            tags: ind.tags,
                        })
                        .collect(),
                    malware_family: intel.malware_family,
                    campaigns: intel.campaigns,
                    actors: intel.actors,
                    ttps: Some(intel.ttps),
                    references: intel.references,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(threat_intel)
}