/// CAPE/Cuckoo Sandbox Report Parser
/// Parses JSON reports from CAPE and Cuckoo Sandbox for dynamic analysis integration
///
/// Based on CAPE Sandbox report format research from DeepWiki

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapeReport {
    pub info: SampleInfo,
    pub behavior: Option<BehaviorSummary>,
    pub signatures: Vec<Signature>,
    pub network: Option<NetworkActivity>,
    pub dropped: Vec<DroppedFile>,
    pub procmemory: Vec<ProcessMemory>,
    pub target: TargetInfo,
    pub debug: Option<DebugInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SampleInfo {
    pub id: Option<u64>,
    pub category: Option<String>,
    pub package: Option<String>,
    pub timeout: Option<u64>,
    pub duration: Option<u64>,
    pub started: Option<String>,
    pub ended: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorSummary {
    pub processes: Vec<ProcessInfo>,
    pub processtree: Vec<ProcessTree>,
    pub summary: Option<HashMap<String, Vec<String>>>,
    pub apistats: Option<HashMap<String, u64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub process_id: u32,
    pub process_name: String,
    pub parent_id: Option<u32>,
    pub first_seen: Option<f64>,
    pub calls: Vec<ApiCall>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTree {
    pub name: String,
    pub pid: u32,
    pub parent_id: Option<u32>,
    pub children: Vec<ProcessTree>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCall {
    pub timestamp: Option<String>,
    pub thread_id: Option<u32>,
    pub category: String,
    pub api: String,
    pub status: Option<bool>,
    pub return_value: Option<String>,
    pub arguments: HashMap<String, String>,
    pub repeated: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub name: String,
    pub description: Option<String>,
    pub severity: u32,
    pub weight: Option<u32>,
    pub confidence: Option<u32>,
    pub references: Option<Vec<String>>,
    pub data: Option<Vec<SignatureData>>,
    pub alert: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureData {
    pub process: Option<String>,
    pub call: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkActivity {
    pub http: Option<Vec<HttpRequest>>,
    pub https: Option<Vec<HttpRequest>>,
    pub dns: Option<Vec<DnsQuery>>,
    pub tcp: Option<Vec<TcpConnection>>,
    pub udp: Option<Vec<UdpConnection>>,
    pub hosts: Option<Vec<String>>,
    pub domains: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub host: String,
    pub port: u16,
    pub path: String,
    pub data: Option<String>,
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsQuery {
    pub request: String,
    pub answers: Vec<DnsAnswer>,
    #[serde(rename = "type")]
    pub query_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsAnswer {
    pub data: String,
    #[serde(rename = "type")]
    pub answer_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpConnection {
    pub src: String,
    pub dst: String,
    pub sport: u16,
    pub dport: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpConnection {
    pub src: String,
    pub dst: String,
    pub sport: u16,
    pub dport: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroppedFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub md5: Option<String>,
    pub sha1: Option<String>,
    pub sha256: Option<String>,
    #[serde(rename = "type")]
    pub file_type: Option<String>,
    pub data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMemory {
    pub pid: u32,
    pub name: String,
    pub regions: Vec<MemoryRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRegion {
    pub addr: String,
    pub size: u64,
    pub protect: Option<String>,
    pub state: Option<String>,
    #[serde(rename = "type")]
    pub region_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetInfo {
    pub category: String,
    pub file: Option<FileInfo>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: Option<String>,
    pub size: Option<u64>,
    pub crc32: Option<String>,
    pub md5: Option<String>,
    pub sha1: Option<String>,
    pub sha256: Option<String>,
    pub sha512: Option<String>,
    pub ssdeep: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugInfo {
    pub errors: Vec<String>,
    pub log: Option<String>,
}

/// Parser for CAPE/Cuckoo reports
pub struct CapeParser;

impl CapeParser {
    /// Parse CAPE JSON report
    pub fn parse_report(json: &str) -> Result<CapeReport, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("Failed to parse CAPE report: {}", e))
    }

    /// Extract IOCs (Indicators of Compromise) from report
    pub fn extract_iocs(report: &CapeReport) -> IOCs {
        let mut iocs = IOCs::default();

        // Extract file hashes
        if let Some(file) = &report.target.file {
            if let Some(md5) = &file.md5 {
                iocs.md5_hashes.push(md5.clone());
            }
            if let Some(sha1) = &file.sha1 {
                iocs.sha1_hashes.push(sha1.clone());
            }
            if let Some(sha256) = &file.sha256 {
                iocs.sha256_hashes.push(sha256.clone());
            }
        }

        // Extract dropped file hashes
        for dropped in &report.dropped {
            if let Some(md5) = &dropped.md5 {
                iocs.md5_hashes.push(md5.clone());
            }
            if let Some(sha256) = &dropped.sha256 {
                iocs.sha256_hashes.push(sha256.clone());
            }
        }

        // Extract network IOCs
        if let Some(network) = &report.network {
            if let Some(hosts) = &network.hosts {
                iocs.ip_addresses.extend(hosts.clone());
            }
            if let Some(domains) = &network.domains {
                iocs.domains.extend(domains.clone());
            }

            // Extract URLs from HTTP requests
            if let Some(http_requests) = &network.http {
                for req in http_requests {
                    let url = format!("http://{}:{}{}", req.host, req.port, req.path);
                    iocs.urls.push(url);
                }
            }
        }

        // Extract registry keys from behavior
        if let Some(behavior) = &report.behavior {
            if let Some(summary) = &behavior.summary {
                if let Some(reg_keys) = summary.get("keys") {
                    iocs.registry_keys.extend(reg_keys.clone());
                }
            }
        }

        iocs
    }

    /// Extract MITRE ATT&CK techniques from signatures
    pub fn extract_mitre_attack(report: &CapeReport) -> Vec<MitreAttack> {
        let mut techniques = Vec::new();

        for sig in &report.signatures {
            // Many CAPE signatures include MITRE ATT&CK references
            if let Some(refs) = &sig.references {
                for reference in refs {
                    if reference.starts_with("T") && reference.len() >= 5 {
                        techniques.push(MitreAttack {
                            technique_id: reference.clone(),
                            signature_name: sig.name.clone(),
                            description: sig.description.clone(),
                            severity: sig.severity,
                        });
                    }
                }
            }
        }

        techniques
    }

    /// Get high-severity signatures
    pub fn get_critical_signatures(report: &CapeReport) -> Vec<&Signature> {
        report.signatures.iter()
            .filter(|sig| sig.severity >= 3)
            .collect()
    }

    /// Analyze API call patterns
    pub fn analyze_api_calls(report: &CapeReport) -> ApiAnalysis {
        let mut analysis = ApiAnalysis::default();

        if let Some(behavior) = &report.behavior {
            for process in &behavior.processes {
                for call in &process.calls {
                    analysis.total_calls += 1;

                    // Count by category
                    *analysis.calls_by_category.entry(call.category.clone())
                        .or_insert(0) += 1;

                    // Count by API
                    *analysis.calls_by_api.entry(call.api.clone())
                        .or_insert(0) += 1;

                    // Detect suspicious patterns
                    if call.category == "registry" {
                        analysis.suspicious_patterns.push(format!(
                            "Registry access: {} in process {}",
                            call.api, process.process_name
                        ));
                    }

                    if call.category == "network" {
                        analysis.suspicious_patterns.push(format!(
                            "Network activity: {} in process {}",
                            call.api, process.process_name
                        ));
                    }

                    if call.category == "process" && call.api.contains("inject") {
                        analysis.suspicious_patterns.push(format!(
                            "Potential injection: {} in process {}",
                            call.api, process.process_name
                        ));
                    }
                }
            }
        }

        analysis
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IOCs {
    pub md5_hashes: Vec<String>,
    pub sha1_hashes: Vec<String>,
    pub sha256_hashes: Vec<String>,
    pub ip_addresses: Vec<String>,
    pub domains: Vec<String>,
    pub urls: Vec<String>,
    pub registry_keys: Vec<String>,
    pub mutexes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MitreAttack {
    pub technique_id: String,
    pub signature_name: String,
    pub description: Option<String>,
    pub severity: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ApiAnalysis {
    pub total_calls: usize,
    pub calls_by_category: HashMap<String, usize>,
    pub calls_by_api: HashMap<String, usize>,
    pub suspicious_patterns: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_minimal_report() {
        let json = r#"{
            "info": {
                "id": 1,
                "category": "file"
            },
            "signatures": [],
            "dropped": [],
            "procmemory": [],
            "target": {
                "category": "file"
            }
        }"#;

        let result = CapeParser::parse_report(json);
        assert!(result.is_ok());

        let report = result.unwrap();
        assert_eq!(report.info.id, Some(1));
    }

    #[test]
    fn test_extract_iocs() {
        let report = CapeReport {
            info: SampleInfo {
                id: Some(1),
                category: None,
                package: None,
                timeout: None,
                duration: None,
                started: None,
                ended: None,
            },
            behavior: None,
            signatures: vec![],
            network: Some(NetworkActivity {
                http: None,
                https: None,
                dns: None,
                tcp: None,
                udp: None,
                hosts: Some(vec!["192.168.1.1".to_string()]),
                domains: Some(vec!["malware.com".to_string()]),
            }),
            dropped: vec![],
            procmemory: vec![],
            target: TargetInfo {
                category: "file".to_string(),
                file: Some(FileInfo {
                    name: "malware.exe".to_string(),
                    path: None,
                    size: None,
                    crc32: None,
                    md5: Some("d41d8cd98f00b204e9800998ecf8427e".to_string()),
                    sha1: None,
                    sha256: None,
                    sha512: None,
                    ssdeep: None,
                }),
                url: None,
            },
            debug: None,
        };

        let iocs = CapeParser::extract_iocs(&report);
        assert_eq!(iocs.md5_hashes.len(), 1);
        assert_eq!(iocs.ip_addresses.len(), 1);
        assert_eq!(iocs.domains.len(), 1);
    }

    #[test]
    fn test_extract_mitre_attack() {
        let report = CapeReport {
            info: SampleInfo {
                id: Some(1),
                category: None,
                package: None,
                timeout: None,
                duration: None,
                started: None,
                ended: None,
            },
            behavior: None,
            signatures: vec![
                Signature {
                    name: "Process Injection".to_string(),
                    description: Some("Injects code into another process".to_string()),
                    severity: 3,
                    weight: Some(2),
                    confidence: Some(100),
                    references: Some(vec!["T1055".to_string()]),
                    data: None,
                    alert: Some(true),
                },
            ],
            network: None,
            dropped: vec![],
            procmemory: vec![],
            target: TargetInfo {
                category: "file".to_string(),
                file: None,
                url: None,
            },
            debug: None,
        };

        let techniques = CapeParser::extract_mitre_attack(&report);
        assert_eq!(techniques.len(), 1);
        assert_eq!(techniques[0].technique_id, "T1055");
    }
}
