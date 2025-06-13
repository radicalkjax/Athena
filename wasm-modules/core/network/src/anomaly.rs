use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use crate::{NetworkAnomaly, PacketAnalysis};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortScanInfo {
    pub scan_type: String,
    pub source_ip: String,
    pub target_ips: Vec<String>,
    pub scanned_ports: Vec<u16>,
    pub duration_ms: u64,
    pub packet_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataExfiltrationInfo {
    pub source_ip: String,
    pub destination_ip: String,
    pub total_bytes: usize,
    pub duration_ms: u64,
    pub protocol: String,
    pub risk_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficAnomaly {
    pub anomaly_type: String,
    pub severity: String,
    pub affected_ips: Vec<String>,
    pub packet_count: usize,
    pub indicators: Vec<String>,
}

pub fn detect_anomalies(traffic_data: &str) -> Result<Vec<NetworkAnomaly>> {
    let packets: Vec<PacketAnalysis> = serde_json::from_str(traffic_data)
        .map_err(|e| anyhow!("Failed to parse traffic data: {}", e))?;

    let mut anomalies = Vec::new();

    // Detect various types of anomalies
    if let Some(anomaly) = detect_packet_flood(&packets) {
        anomalies.push(anomaly);
    }

    if let Some(anomaly) = detect_protocol_anomalies(&packets) {
        anomalies.push(anomaly);
    }

    if let Some(anomaly) = detect_timing_anomalies(&packets) {
        anomalies.push(anomaly);
    }

    if let Some(anomaly) = detect_payload_anomalies(&packets) {
        anomalies.push(anomaly);
    }

    Ok(anomalies)
}

pub fn detect_port_scan(packets_json: &str) -> Result<Value> {
    let packets: Vec<PacketAnalysis> = serde_json::from_str(packets_json)
        .map_err(|e| anyhow!("Failed to parse packets: {}", e))?;

    let mut source_activity: HashMap<String, PortScanActivity> = HashMap::new();

    // Analyze packet patterns
    for packet in &packets {
        if let (Some(src), Some(dst), Some(port)) = (&packet.source_ip, &packet.dest_ip, packet.dest_port) {
            let activity = source_activity.entry(src.clone()).or_insert_with(|| PortScanActivity {
                targets: HashSet::new(),
                ports: HashSet::new(),
                syn_count: 0,
                ack_count: 0,
                rst_count: 0,
                first_seen: packet.timestamp.unwrap_or(0),
                last_seen: packet.timestamp.unwrap_or(0),
            });

            activity.targets.insert(dst.clone());
            activity.ports.insert(port);
            activity.last_seen = packet.timestamp.unwrap_or(0);

            // Count TCP flags
            if packet.flags.contains(&"SYN".to_string()) && !packet.flags.contains(&"ACK".to_string()) {
                activity.syn_count += 1;
            }
            if packet.flags.contains(&"ACK".to_string()) {
                activity.ack_count += 1;
            }
            if packet.flags.contains(&"RST".to_string()) {
                activity.rst_count += 1;
            }
        }
    }

    // Identify port scans
    let mut scan_infos = Vec::new();
    
    for (source, activity) in source_activity {
        let scan_type = identify_scan_type(&activity);
        
        if !scan_type.is_empty() {
            scan_infos.push(PortScanInfo {
                scan_type,
                source_ip: source,
                target_ips: activity.targets.into_iter().collect(),
                scanned_ports: activity.ports.into_iter().collect(),
                duration_ms: (activity.last_seen - activity.first_seen) as u64 * 1000,
                packet_count: activity.syn_count + activity.ack_count + activity.rst_count,
            });
        }
    }

    Ok(json!({
        "scans_detected": scan_infos.len(),
        "scan_details": scan_infos,
    }))
}

pub fn detect_data_exfiltration(traffic_json: &str) -> Result<Value> {
    let packets: Vec<PacketAnalysis> = serde_json::from_str(traffic_json)
        .map_err(|e| anyhow!("Failed to parse traffic: {}", e))?;

    let mut flow_stats: HashMap<String, FlowStatistics> = HashMap::new();

    // Collect flow statistics
    for packet in &packets {
        if let (Some(src), Some(dst)) = (&packet.source_ip, &packet.dest_ip) {
            let flow_key = format!("{}->{}", src, dst);
            
            let stats = flow_stats.entry(flow_key.clone()).or_insert_with(|| FlowStatistics {
                source: src.clone(),
                destination: dst.clone(),
                total_bytes: 0,
                packet_count: 0,
                first_seen: packet.timestamp.unwrap_or(0),
                last_seen: packet.timestamp.unwrap_or(0),
                protocol: packet.protocol.clone(),
            });

            stats.total_bytes += packet.payload_size;
            stats.packet_count += 1;
            stats.last_seen = packet.timestamp.unwrap_or(0);
        }
    }

    // Analyze for exfiltration patterns
    let mut exfiltration_candidates = Vec::new();

    for (_, stats) in flow_stats {
        let risk_score = calculate_exfiltration_risk(&stats);
        
        if risk_score > 0.5 {
            exfiltration_candidates.push(DataExfiltrationInfo {
                source_ip: stats.source,
                destination_ip: stats.destination,
                total_bytes: stats.total_bytes,
                duration_ms: (stats.last_seen - stats.first_seen) as u64 * 1000,
                protocol: stats.protocol,
                risk_score,
            });
        }
    }

    // Sort by risk score
    exfiltration_candidates.sort_by(|a, b| b.risk_score.partial_cmp(&a.risk_score).unwrap());

    Ok(json!({
        "exfiltration_detected": !exfiltration_candidates.is_empty(),
        "high_risk_flows": exfiltration_candidates.len(),
        "flows": exfiltration_candidates,
    }))
}

fn detect_packet_flood(packets: &[PacketAnalysis]) -> Option<NetworkAnomaly> {
    let mut packet_rate: HashMap<i64, usize> = HashMap::new();
    
    // Count packets per second
    for packet in packets {
        if let Some(ts) = packet.timestamp {
            *packet_rate.entry(ts).or_insert(0) += 1;
        }
    }

    // Check for flood
    let high_rate_seconds = packet_rate.values().filter(|&&rate| rate > 1000).count();
    
    if high_rate_seconds > 5 {
        Some(NetworkAnomaly {
            anomaly_type: "Packet Flood".to_string(),
            severity: "High".to_string(),
            description: format!("Detected {} seconds with >1000 packets/sec", high_rate_seconds),
            indicators: vec![
                "Excessive packet rate".to_string(),
                "Possible DoS attack".to_string(),
            ],
            timestamp: chrono::Utc::now().timestamp(),
        })
    } else {
        None
    }
}

fn detect_protocol_anomalies(packets: &[PacketAnalysis]) -> Option<NetworkAnomaly> {
    let mut anomaly_indicators = Vec::new();
    
    for packet in packets {
        // Check for malformed TCP flags
        if packet.protocol == "TCP" {
            if packet.flags.contains(&"SYN".to_string()) && packet.flags.contains(&"FIN".to_string()) {
                anomaly_indicators.push("Invalid TCP flags combination (SYN+FIN)".to_string());
            }
            
            if packet.flags.is_empty() && packet.payload_size == 0 {
                anomaly_indicators.push("NULL TCP packet detected".to_string());
            }
        }

        // Check for unusual protocols
        if matches!(packet.protocol.as_str(), "Unknown" | "ICMP" | "ICMPv6") {
            if packet.payload_size > 1000 {
                anomaly_indicators.push(format!("Large {} packet ({}B)", packet.protocol, packet.payload_size));
            }
        }
    }

    if !anomaly_indicators.is_empty() {
        Some(NetworkAnomaly {
            anomaly_type: "Protocol Anomaly".to_string(),
            severity: "Medium".to_string(),
            description: "Detected unusual protocol behavior".to_string(),
            indicators: anomaly_indicators,
            timestamp: chrono::Utc::now().timestamp(),
        })
    } else {
        None
    }
}

fn detect_timing_anomalies(packets: &[PacketAnalysis]) -> Option<NetworkAnomaly> {
    if packets.len() < 10 {
        return None;
    }

    let mut timestamps: Vec<i64> = packets
        .iter()
        .filter_map(|p| p.timestamp)
        .collect();
    
    timestamps.sort();

    // Check for burst patterns
    let mut burst_count = 0;
    for i in 1..timestamps.len() {
        if timestamps[i] - timestamps[i-1] < 10 {
            burst_count += 1;
        }
    }

    if burst_count as f64 / timestamps.len() as f64 > 0.7 {
        Some(NetworkAnomaly {
            anomaly_type: "Timing Anomaly".to_string(),
            severity: "Medium".to_string(),
            description: "Detected burst traffic pattern".to_string(),
            indicators: vec![
                format!("{}% of packets in bursts", (burst_count * 100 / timestamps.len())),
                "Possible automated traffic".to_string(),
            ],
            timestamp: chrono::Utc::now().timestamp(),
        })
    } else {
        None
    }
}

fn detect_payload_anomalies(packets: &[PacketAnalysis]) -> Option<NetworkAnomaly> {
    let mut anomalies = Vec::new();
    let mut total_size = 0;
    let mut large_packets = 0;

    for packet in packets {
        total_size += packet.payload_size;
        
        // Check for unusually large payloads
        if packet.payload_size > 10000 {
            large_packets += 1;
        }

        // Check for specific patterns in small packets
        if packet.payload_size == 1 || packet.payload_size == 0 {
            if packet.protocol == "TCP" && !packet.flags.contains(&"FIN".to_string()) {
                anomalies.push("Suspicious small payload".to_string());
            }
        }
    }

    if large_packets > 10 || !anomalies.is_empty() {
        Some(NetworkAnomaly {
            anomaly_type: "Payload Anomaly".to_string(),
            severity: if large_packets > 50 { "High" } else { "Medium" }.to_string(),
            description: "Detected unusual payload patterns".to_string(),
            indicators: {
                let mut indicators = anomalies;
                if large_packets > 0 {
                    indicators.push(format!("{} large packets detected", large_packets));
                }
                if total_size > 100_000_000 {
                    indicators.push(format!("Total payload size: {} MB", total_size / 1_000_000));
                }
                indicators
            },
            timestamp: chrono::Utc::now().timestamp(),
        })
    } else {
        None
    }
}

// Helper structures
struct PortScanActivity {
    targets: HashSet<String>,
    ports: HashSet<u16>,
    syn_count: usize,
    ack_count: usize,
    rst_count: usize,
    first_seen: i64,
    last_seen: i64,
}

struct FlowStatistics {
    source: String,
    destination: String,
    total_bytes: usize,
    packet_count: usize,
    first_seen: i64,
    last_seen: i64,
    protocol: String,
}

fn identify_scan_type(activity: &PortScanActivity) -> String {
    let port_count = activity.ports.len();
    let target_count = activity.targets.len();
    
    if port_count > 100 && target_count == 1 {
        "Vertical Port Scan".to_string()
    } else if port_count < 10 && target_count > 10 {
        "Horizontal Port Scan".to_string()
    } else if port_count > 20 && target_count > 5 {
        "Block Scan".to_string()
    } else if activity.syn_count > 0 && activity.ack_count == 0 {
        "SYN Scan".to_string()
    } else if activity.rst_count > activity.syn_count / 2 {
        "Stealth Scan".to_string()
    } else if port_count > 20 || target_count > 20 {
        "General Scan".to_string()
    } else {
        String::new()
    }
}

fn calculate_exfiltration_risk(stats: &FlowStatistics) -> f64 {
    let mut risk: f64 = 0.0;
    
    // Large data transfer
    if stats.total_bytes > 100_000_000 {
        risk += 0.4;
    } else if stats.total_bytes > 10_000_000 {
        risk += 0.3;
    }

    // Long duration
    let duration_hours = (stats.last_seen - stats.first_seen) as f64 / 3600.0;
    if duration_hours > 1.0 {
        risk += 0.2;
    }

    // High packet rate with large payloads
    let avg_packet_size = stats.total_bytes as f64 / stats.packet_count as f64;
    if avg_packet_size > 1000.0 && stats.packet_count > 1000 {
        risk += 0.3;
    }

    // External destination (simplified check)
    if !stats.destination.starts_with("192.168.") 
        && !stats.destination.starts_with("10.") 
        && !stats.destination.starts_with("172.") {
        risk += 0.2;
    }

    risk.min(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_type_identification() {
        let activity = PortScanActivity {
            targets: vec!["192.168.1.1".to_string()].into_iter().collect(),
            ports: (1..=1000).collect(),
            syn_count: 1000,
            ack_count: 0,
            rst_count: 0,
            first_seen: 0,
            last_seen: 1000,
        };

        assert_eq!(identify_scan_type(&activity), "Vertical Port Scan");
    }
}