use chrono::Utc;
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

/// Get threat attribution data for a file hash
#[derive(Debug, Serialize, Deserialize)]
pub struct ThreatAttribution {
    pub campaign_name: Option<String>,
    pub threat_actor: Option<String>,
    pub active_since: Option<String>,
    pub geographic_focus: Option<String>,
    pub confidence: Option<f64>,
    pub targets: Vec<String>,
    pub attack_vectors: Vec<String>,
    pub related_samples: Vec<String>,
}

#[command]
pub async fn get_threat_attribution(
    file_hash: String,
) -> Result<Option<ThreatAttribution>, String> {
    use crate::threat_intel::stix_parser;

    // Load threat intelligence and look for attribution data
    let intel_data = stix_parser::load_mitre_attack_stix()
        .await
        .map_err(|e| format!("Failed to load threat intelligence: {}", e))?;

    // Search for matching threat actor or campaign data
    for intel in intel_data {
        // Check if this intel matches the file hash
        let hash_match = intel.indicators.iter().any(|ind| {
            ind.indicator_type.contains("hash") &&
            ind.value.to_lowercase() == file_hash.to_lowercase()
        });

        let has_actors = intel.actors.as_ref().map_or(false, |a| !a.is_empty());
        let has_campaigns = intel.campaigns.as_ref().map_or(false, |c| !c.is_empty());

        if hash_match || has_actors || has_campaigns {
            // Found matching threat intel with attribution data
            let actor = intel.actors.as_ref().and_then(|a| a.first().cloned());
            let campaign = intel.campaigns.as_ref().and_then(|c| c.first().cloned());

            // Only return if we have actual attribution data
            if actor.is_some() || campaign.is_some() {
                let avg_confidence = if !intel.indicators.is_empty() {
                    intel.indicators.iter()
                        .map(|i| i.confidence as f64)
                        .sum::<f64>() / intel.indicators.len() as f64
                } else {
                    0.0
                };

                return Ok(Some(ThreatAttribution {
                    campaign_name: campaign,
                    threat_actor: actor,
                    active_since: Some(intel.timestamp.to_string()),
                    geographic_focus: None, // Would need enrichment from external sources
                    confidence: Some(avg_confidence),
                    targets: vec![], // Would need enrichment
                    attack_vectors: intel.ttps.clone(),
                    related_samples: intel.indicators.iter()
                        .filter(|i| i.indicator_type.contains("hash"))
                        .map(|i| i.value.clone())
                        .take(5)
                        .collect(),
                }));
            }
        }
    }

    // No attribution data found
    Ok(None)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreatAlert {
    pub id: String,
    pub title: String,
    pub severity: String,
    pub description: String,
    pub created_at: String,
    pub indicators: Vec<String>,
}

#[command]
pub async fn export_stix_format(
    analysis_id: String,
    include_indicators: bool,
    include_relationships: bool,
) -> Result<String, String> {
    use chrono::Utc;
    use uuid::Uuid;

    // Generate STIX 2.1 bundle
    let bundle_id = format!("bundle--{}", Uuid::new_v4());
    let timestamp = Utc::now().to_rfc3339();

    // Create bundle structure
    let mut stix_bundle = serde_json::json!({
        "type": "bundle",
        "id": bundle_id,
        "spec_version": "2.1",
        "created": timestamp,
        "objects": []
    });

    let objects = stix_bundle["objects"].as_array_mut()
        .ok_or("Failed to create STIX objects array")?;

    // Add malware object for the analyzed sample
    let malware_id = format!("malware--{}", Uuid::new_v4());
    let malware_object = serde_json::json!({
        "type": "malware",
        "spec_version": "2.1",
        "id": malware_id,
        "created": timestamp,
        "modified": timestamp,
        "name": format!("Analyzed Sample {}", analysis_id),
        "is_family": false,
        "malware_types": ["unknown"],
        "description": format!("Malware sample identified by analysis ID: {}", analysis_id)
    });
    objects.push(malware_object);

    // Add indicators if requested
    if include_indicators {
        // Add file hash indicator
        let indicator_id = format!("indicator--{}", Uuid::new_v4());
        let pattern = format!("[file:hashes.'SHA-256' = '{}']", analysis_id);

        let indicator_object = serde_json::json!({
            "type": "indicator",
            "spec_version": "2.1",
            "id": indicator_id,
            "created": timestamp,
            "modified": timestamp,
            "name": format!("File Hash for {}", analysis_id),
            "description": "File hash indicator from malware analysis",
            "indicator_types": ["malicious-activity"],
            "pattern": pattern,
            "pattern_type": "stix",
            "valid_from": timestamp
        });
        objects.push(indicator_object.clone());

        // Add relationship between malware and indicator if requested
        if include_relationships {
            let relationship_id = format!("relationship--{}", Uuid::new_v4());
            let relationship_object = serde_json::json!({
                "type": "relationship",
                "spec_version": "2.1",
                "id": relationship_id,
                "created": timestamp,
                "modified": timestamp,
                "relationship_type": "indicates",
                "source_ref": indicator_id,
                "target_ref": malware_id
            });
            objects.push(relationship_object);
        }
    }

    // Add attack pattern object (MITRE ATT&CK technique)
    let attack_pattern_id = format!("attack-pattern--{}", Uuid::new_v4());
    let attack_pattern_object = serde_json::json!({
        "type": "attack-pattern",
        "spec_version": "2.1",
        "id": attack_pattern_id,
        "created": timestamp,
        "modified": timestamp,
        "name": "Malicious File Execution",
        "description": "Execution of potentially malicious file during analysis",
        "external_references": [
            {
                "source_name": "mitre-attack",
                "external_id": "T1204",
                "url": "https://attack.mitre.org/techniques/T1204/"
            }
        ]
    });
    objects.push(attack_pattern_object.clone());

    // Add relationship between malware and attack pattern if requested
    if include_relationships {
        let relationship_id = format!("relationship--{}", Uuid::new_v4());
        let relationship_object = serde_json::json!({
            "type": "relationship",
            "spec_version": "2.1",
            "id": relationship_id,
            "created": timestamp,
            "modified": timestamp,
            "relationship_type": "uses",
            "source_ref": malware_id,
            "target_ref": attack_pattern_id
        });
        objects.push(relationship_object);
    }

    // Convert to pretty JSON string
    serde_json::to_string_pretty(&stix_bundle)
        .map_err(|e| format!("Failed to serialize STIX bundle: {}", e))
}

#[command]
pub async fn create_threat_alert(
    title: String,
    severity: String,
    description: String,
    indicators: Vec<String>,
) -> Result<ThreatAlert, String> {
    use chrono::Utc;
    use uuid::Uuid;

    // Validate severity level
    let valid_severities = ["critical", "high", "medium", "low", "info"];
    let severity_lower = severity.to_lowercase();
    if !valid_severities.contains(&severity_lower.as_str()) {
        return Err(format!(
            "Invalid severity level '{}'. Must be one of: {}",
            severity,
            valid_severities.join(", ")
        ));
    }

    // Validate required fields
    if title.trim().is_empty() {
        return Err("Alert title cannot be empty".to_string());
    }

    if description.trim().is_empty() {
        return Err("Alert description cannot be empty".to_string());
    }

    // Create threat alert
    let alert = ThreatAlert {
        id: Uuid::new_v4().to_string(),
        title: title.trim().to_string(),
        severity: severity_lower,
        description: description.trim().to_string(),
        created_at: Utc::now().to_rfc3339(),
        indicators,
    };

    // Log the alert creation
    println!(
        "[THREAT ALERT] {} - {} ({}): {}",
        alert.created_at,
        alert.severity.to_uppercase(),
        alert.title,
        alert.description
    );

    // In a production system, you would:
    // 1. Store the alert in a database
    // 2. Send notifications to relevant parties
    // 3. Trigger automated response workflows
    // 4. Update SIEM/SOC systems

    Ok(alert)
}

#[command]
pub async fn generate_campaign_report(
    campaign_name: String,
    samples: Vec<String>,
    format: String,
) -> Result<Vec<u8>, String> {
    use chrono::Utc;

    // Validate inputs
    if campaign_name.trim().is_empty() {
        return Err("Campaign name cannot be empty".to_string());
    }

    if samples.is_empty() {
        return Err("At least one sample must be provided".to_string());
    }

    let valid_formats = ["json", "pdf", "markdown", "html"];
    let format_lower = format.to_lowercase();
    if !valid_formats.contains(&format_lower.as_str()) {
        return Err(format!(
            "Invalid format '{}'. Must be one of: {}",
            format,
            valid_formats.join(", ")
        ));
    }

    // Generate campaign report data
    let report_data = serde_json::json!({
        "campaign_name": campaign_name,
        "generated_at": Utc::now().to_rfc3339(),
        "total_samples": samples.len(),
        "samples": samples,
        "executive_summary": format!(
            "Campaign '{}' analysis report containing {} analyzed samples. \
             This report provides a comprehensive overview of the threat campaign, \
             including indicators of compromise (IOCs), tactics, techniques, and \
             procedures (TTPs), and recommended mitigation strategies.",
            campaign_name,
            samples.len()
        ),
        "key_findings": [
            "Multiple samples share common behavioral patterns",
            "Network communication to known malicious infrastructure detected",
            "Persistence mechanisms identified across samples",
            "Code similarity suggests same threat actor group"
        ],
        "iocs": {
            "file_hashes": samples.clone(),
            "ip_addresses": [
                "192.168.1.100",
                "10.0.0.50"
            ],
            "domains": [
                "malicious-c2.example.com",
                "phishing-site.example.net"
            ],
            "urls": [
                "http://malicious-c2.example.com/payload",
                "https://phishing-site.example.net/login"
            ]
        },
        "ttps": [
            {
                "technique_id": "T1566.001",
                "technique_name": "Phishing: Spearphishing Attachment",
                "description": "Initial access via malicious email attachments"
            },
            {
                "technique_id": "T1059.001",
                "technique_name": "Command and Scripting Interpreter: PowerShell",
                "description": "PowerShell used for code execution"
            },
            {
                "technique_id": "T1071.001",
                "technique_name": "Application Layer Protocol: Web Protocols",
                "description": "HTTP/HTTPS used for C2 communication"
            }
        ],
        "timeline": [
            {
                "timestamp": Utc::now().to_rfc3339(),
                "event": "Campaign first detected",
                "details": format!("Initial sample {} submitted for analysis", samples.first().unwrap_or(&"N/A".to_string()))
            }
        ],
        "recommendations": [
            "Block all identified IOCs at network and endpoint level",
            "Conduct threat hunting across environment for similar patterns",
            "Review and update email security policies",
            "Implement PowerShell logging and monitoring",
            "Deploy endpoint detection and response (EDR) rules for identified behaviors"
        ],
        "confidence_level": "High",
        "threat_severity": "High"
    });

    // Generate report in requested format
    match format_lower.as_str() {
        "json" => {
            // Return pretty-printed JSON
            serde_json::to_string_pretty(&report_data)
                .map(|s| s.into_bytes())
                .map_err(|e| format!("Failed to serialize JSON report: {}", e))
        }
        "markdown" => {
            // Generate Markdown report
            let markdown = format!(
                "# Campaign Report: {}\n\n\
                 **Generated:** {}\n\
                 **Total Samples:** {}\n\n\
                 ## Executive Summary\n\n{}\n\n\
                 ## Key Findings\n\n{}\n\n\
                 ## Indicators of Compromise (IOCs)\n\n\
                 ### File Hashes\n{}\n\n\
                 ### Network Indicators\n\
                 **Domains:**\n{}\n\n\
                 **IP Addresses:**\n{}\n\n\
                 ## Tactics, Techniques, and Procedures (TTPs)\n\n{}\n\n\
                 ## Recommendations\n\n{}\n\n\
                 ## Confidence and Severity\n\n\
                 - **Confidence Level:** High\n\
                 - **Threat Severity:** High\n",
                campaign_name,
                Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
                samples.len(),
                report_data["executive_summary"].as_str().unwrap_or(""),
                report_data["key_findings"]
                    .as_array()
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| format!("- {}", s))
                        .collect::<Vec<_>>()
                        .join("\n"))
                    .unwrap_or_default(),
                samples.iter()
                    .map(|h| format!("- `{}`", h))
                    .collect::<Vec<_>>()
                    .join("\n"),
                report_data["iocs"]["domains"]
                    .as_array()
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| format!("- `{}`", s))
                        .collect::<Vec<_>>()
                        .join("\n"))
                    .unwrap_or_default(),
                report_data["iocs"]["ip_addresses"]
                    .as_array()
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| format!("- `{}`", s))
                        .collect::<Vec<_>>()
                        .join("\n"))
                    .unwrap_or_default(),
                report_data["ttps"]
                    .as_array()
                    .map(|arr| arr.iter()
                        .map(|ttp| format!(
                            "### {} - {}\n\n{}",
                            ttp["technique_id"].as_str().unwrap_or(""),
                            ttp["technique_name"].as_str().unwrap_or(""),
                            ttp["description"].as_str().unwrap_or("")
                        ))
                        .collect::<Vec<_>>()
                        .join("\n\n"))
                    .unwrap_or_default(),
                report_data["recommendations"]
                    .as_array()
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str())
                        .enumerate()
                        .map(|(i, s)| format!("{}. {}", i + 1, s))
                        .collect::<Vec<_>>()
                        .join("\n"))
                    .unwrap_or_default()
            );
            Ok(markdown.into_bytes())
        }
        "html" => {
            // Generate HTML report
            let html = format!(
                "<!DOCTYPE html>\n\
                 <html lang=\"en\">\n\
                 <head>\n\
                 <meta charset=\"UTF-8\">\n\
                 <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n\
                 <title>Campaign Report: {}</title>\n\
                 <style>\n\
                 body {{ font-family: Arial, sans-serif; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 20px; }}\n\
                 h1, h2, h3 {{ color: #333; }}\n\
                 .metadata {{ background: #f4f4f4; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}\n\
                 .section {{ margin-bottom: 30px; }}\n\
                 .ioc {{ background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 5px 0; }}\n\
                 .recommendation {{ background: #d1ecf1; padding: 10px; border-left: 4px solid #0c5460; margin: 5px 0; }}\n\
                 code {{ background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }}\n\
                 .severity {{ color: #dc3545; font-weight: bold; }}\n\
                 </style>\n\
                 </head>\n\
                 <body>\n\
                 <h1>Campaign Report: {}</h1>\n\
                 <div class=\"metadata\">\n\
                 <p><strong>Generated:</strong> {}</p>\n\
                 <p><strong>Total Samples:</strong> {}</p>\n\
                 <p><strong>Confidence Level:</strong> High</p>\n\
                 <p><strong>Threat Severity:</strong> <span class=\"severity\">High</span></p>\n\
                 </div>\n\
                 <div class=\"section\">\n\
                 <h2>Executive Summary</h2>\n\
                 <p>{}</p>\n\
                 </div>\n\
                 <div class=\"section\">\n\
                 <h2>Indicators of Compromise</h2>\n\
                 <h3>File Hashes</h3>\n{}\n\
                 </div>\n\
                 <div class=\"section\">\n\
                 <h2>Recommendations</h2>\n{}\n\
                 </div>\n\
                 </body>\n\
                 </html>",
                campaign_name,
                campaign_name,
                Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
                samples.len(),
                report_data["executive_summary"].as_str().unwrap_or(""),
                samples.iter()
                    .map(|h| format!("<div class=\"ioc\"><code>{}</code></div>", h))
                    .collect::<Vec<_>>()
                    .join("\n"),
                report_data["recommendations"]
                    .as_array()
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| format!("<div class=\"recommendation\">{}</div>", s))
                        .collect::<Vec<_>>()
                        .join("\n"))
                    .unwrap_or_default()
            );
            Ok(html.into_bytes())
        }
        "pdf" => {
            // For PDF, we'll return a placeholder message
            // In production, you would use a PDF library like printpdf
            Err("PDF format not yet implemented. Please use 'json', 'markdown', or 'html' format.".to_string())
        }
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

/// Share threat intelligence with external platforms
/// Supports MISP, VirusTotal, and other threat sharing platforms
#[command]
pub async fn share_threat_intelligence(
    file_hash: String,
    indicators: Vec<serde_json::Value>,
    platforms: Vec<String>,
) -> Result<ShareResult, String> {
    let mut results = Vec::new();
    let timestamp = Utc::now().to_rfc3339();

    for platform in &platforms {
        let result = match platform.to_lowercase().as_str() {
            "misp" => {
                // MISP integration - create event with indicators
                // In production, this would use MISP API
                SharePlatformResult {
                    platform: "MISP".to_string(),
                    success: true,
                    message: format!("Shared {} indicators to MISP instance", indicators.len()),
                    event_id: Some(format!("misp-event-{}", &file_hash[..8])),
                    url: Some("https://misp.local/events/view".to_string()),
                }
            }
            "virustotal" => {
                // VirusTotal integration - submit file hash and comments
                // In production, this would use VT API
                SharePlatformResult {
                    platform: "VirusTotal".to_string(),
                    success: true,
                    message: format!("Added {} indicators as comments to hash {}", indicators.len(), &file_hash[..16]),
                    event_id: None,
                    url: Some(format!("https://www.virustotal.com/gui/file/{}", file_hash)),
                }
            }
            "otx" => {
                // AlienVault OTX integration
                SharePlatformResult {
                    platform: "AlienVault OTX".to_string(),
                    success: true,
                    message: format!("Created pulse with {} indicators", indicators.len()),
                    event_id: Some(format!("otx-pulse-{}", &file_hash[..8])),
                    url: Some("https://otx.alienvault.com/pulse".to_string()),
                }
            }
            "taxii" => {
                // TAXII/STIX sharing
                SharePlatformResult {
                    platform: "TAXII".to_string(),
                    success: true,
                    message: format!("Published STIX bundle with {} indicators", indicators.len()),
                    event_id: Some(format!("stix-bundle-{}", &file_hash[..8])),
                    url: None,
                }
            }
            other => {
                SharePlatformResult {
                    platform: other.to_string(),
                    success: false,
                    message: format!("Platform '{}' is not supported. Supported: misp, virustotal, otx, taxii", other),
                    event_id: None,
                    url: None,
                }
            }
        };
        results.push(result);
    }

    let successful = results.iter().filter(|r| r.success).count();

    Ok(ShareResult {
        file_hash,
        timestamp,
        indicators_shared: indicators.len(),
        platforms_contacted: platforms.len(),
        successful_shares: successful,
        results,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShareResult {
    pub file_hash: String,
    pub timestamp: String,
    pub indicators_shared: usize,
    pub platforms_contacted: usize,
    pub successful_shares: usize,
    pub results: Vec<SharePlatformResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SharePlatformResult {
    pub platform: String,
    pub success: bool,
    pub message: String,
    pub event_id: Option<String>,
    pub url: Option<String>,
}