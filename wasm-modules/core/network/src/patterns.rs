use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use crate::{TrafficPattern, PacketAnalysis};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CCPattern {
    pub pattern_type: String,
    pub confidence: f64,
    pub indicators: Vec<String>,
    pub iocs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficFlow {
    pub source: String,
    pub destination: String,
    pub protocol: String,
    pub packet_count: usize,
    pub byte_count: usize,
    pub duration_ms: u64,
    pub flags: HashSet<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeaconingPattern {
    pub interval_ms: u64,
    pub jitter: f64,
    pub destination: String,
    pub packet_count: usize,
    pub confidence: f64,
}

pub fn analyze_traffic_pattern(packets_json: &str) -> Result<Vec<TrafficPattern>> {
    let packets: Vec<PacketAnalysis> = serde_json::from_str(packets_json)
        .map_err(|e| anyhow!("Failed to parse packets JSON: {}", e))?;

    let mut patterns = Vec::new();

    // Analyze flows
    let flows = analyze_flows(&packets);
    for (_, flow) in flows.iter() {
        if let Some(pattern) = detect_flow_pattern(flow) {
            patterns.push(pattern);
        }
    }

    // Detect beaconing
    if let Some(beaconing) = detect_beaconing(&packets) {
        patterns.push(TrafficPattern {
            pattern_type: "Beaconing".to_string(),
            confidence: beaconing.confidence,
            matches: vec![format!("Beacon to {} every {}ms", beaconing.destination, beaconing.interval_ms)],
            metadata: json!(beaconing),
        });
    }

    // Detect scanning patterns
    if let Some(scan_pattern) = detect_scanning_pattern(&packets) {
        patterns.push(scan_pattern);
    }

    // Detect data staging
    if let Some(staging) = detect_data_staging(&packets) {
        patterns.push(staging);
    }

    Ok(patterns)
}

pub fn detect_cc_patterns(traffic_json: &str) -> Result<Value> {
    let packets: Vec<PacketAnalysis> = serde_json::from_str(traffic_json)
        .map_err(|e| anyhow!("Failed to parse traffic JSON: {}", e))?;

    let mut cc_patterns = Vec::new();

    // Check for known C&C patterns
    if let Some(pattern) = detect_http_cc_pattern(&packets) {
        cc_patterns.push(pattern);
    }

    if let Some(pattern) = detect_dns_cc_pattern(&packets) {
        cc_patterns.push(pattern);
    }

    if let Some(pattern) = detect_encrypted_cc_pattern(&packets) {
        cc_patterns.push(pattern);
    }

    // Check for periodic callbacks
    if let Some(beaconing) = detect_beaconing(&packets) {
        cc_patterns.push(CCPattern {
            pattern_type: "Periodic Callback".to_string(),
            confidence: beaconing.confidence,
            indicators: vec![
                format!("Regular communication every {}ms", beaconing.interval_ms),
                format!("Jitter: {:.2}%", beaconing.jitter * 100.0),
            ],
            iocs: vec![beaconing.destination],
        });
    }

    Ok(json!({
        "patterns": cc_patterns,
        "total_detected": cc_patterns.len(),
        "high_confidence": cc_patterns.iter().filter(|p| p.confidence > 0.8).count(),
    }))
}

fn analyze_flows(packets: &[PacketAnalysis]) -> HashMap<String, TrafficFlow> {
    let mut flows = HashMap::new();

    for packet in packets {
        if let (Some(src), Some(dst)) = (&packet.source_ip, &packet.dest_ip) {
            let flow_key = format!("{}-{}-{}", src, dst, packet.protocol);
            
            let flow = flows.entry(flow_key.clone()).or_insert_with(|| TrafficFlow {
                source: src.clone(),
                destination: dst.clone(),
                protocol: packet.protocol.clone(),
                packet_count: 0,
                byte_count: 0,
                duration_ms: 0,
                flags: HashSet::new(),
            });

            flow.packet_count += 1;
            flow.byte_count += packet.payload_size;
            
            for flag in &packet.flags {
                flow.flags.insert(flag.clone());
            }
        }
    }

    flows
}

fn detect_flow_pattern(flow: &TrafficFlow) -> Option<TrafficPattern> {
    let mut indicators = Vec::new();
    let mut confidence: f64 = 0.0;

    // Large data transfer pattern
    if flow.byte_count > 10_000_000 {
        indicators.push("Large data transfer detected".to_string());
        confidence += 0.3;
    }

    // Suspicious port usage
    let suspicious_ports = vec![4444, 5555, 6666, 7777, 8888, 9999, 31337];
    if let Some(port) = flow.destination.split(':').nth(1).and_then(|p| p.parse::<u16>().ok()) {
        if suspicious_ports.contains(&port) {
            indicators.push(format!("Suspicious port {} detected", port));
            confidence += 0.4;
        }
    }

    // Long duration connections
    if flow.duration_ms > 3600000 {
        indicators.push("Long duration connection".to_string());
        confidence += 0.2;
    }

    if !indicators.is_empty() {
        Some(TrafficPattern {
            pattern_type: "Suspicious Flow".to_string(),
            confidence: confidence.min(1.0),
            matches: indicators,
            metadata: json!(flow),
        })
    } else {
        None
    }
}

fn detect_beaconing(packets: &[PacketAnalysis]) -> Option<BeaconingPattern> {
    // Group packets by destination
    let mut dest_packets: HashMap<String, Vec<i64>> = HashMap::new();

    for packet in packets {
        if let (Some(dst), Some(ts)) = (&packet.dest_ip, packet.timestamp) {
            dest_packets.entry(dst.clone()).or_insert_with(Vec::new).push(ts);
        }
    }

    // Look for regular intervals
    for (dest, mut timestamps) in dest_packets {
        timestamps.sort();
        
        if timestamps.len() < 5 {
            continue;
        }

        let mut intervals = Vec::new();
        for i in 1..timestamps.len() {
            intervals.push((timestamps[i] - timestamps[i-1]) as u64 * 1000);
        }

        // Calculate average interval and jitter
        let avg_interval = intervals.iter().sum::<u64>() / intervals.len() as u64;
        let variance = intervals.iter()
            .map(|&i| ((i as f64 - avg_interval as f64).powi(2)))
            .sum::<f64>() / intervals.len() as f64;
        let std_dev = variance.sqrt();
        let jitter = std_dev / avg_interval as f64;

        // Check if this looks like beaconing
        if jitter < 0.3 && avg_interval > 1000 && avg_interval < 3600000 {
            return Some(BeaconingPattern {
                interval_ms: avg_interval,
                jitter,
                destination: dest,
                packet_count: timestamps.len(),
                confidence: (1.0 - jitter).max(0.7),
            });
        }
    }

    None
}

fn detect_scanning_pattern(packets: &[PacketAnalysis]) -> Option<TrafficPattern> {
    let mut source_targets: HashMap<String, HashSet<String>> = HashMap::new();
    let mut syn_packets = 0;
    let mut total_packets = 0;

    for packet in packets {
        if let (Some(src), Some(dst)) = (&packet.source_ip, &packet.dest_ip) {
            source_targets.entry(src.clone()).or_insert_with(HashSet::new).insert(dst.clone());
            
            if packet.flags.contains(&"SYN".to_string()) && !packet.flags.contains(&"ACK".to_string()) {
                syn_packets += 1;
            }
            total_packets += 1;
        }
    }

    // Check for port scanning (many destinations from single source)
    for (source, targets) in source_targets {
        if targets.len() > 20 {
            let syn_ratio = syn_packets as f64 / total_packets as f64;
            
            return Some(TrafficPattern {
                pattern_type: "Port Scanning".to_string(),
                confidence: (targets.len() as f64 / 100.0).min(0.95),
                matches: vec![
                    format!("Source {} scanned {} targets", source, targets.len()),
                    format!("SYN packet ratio: {:.2}", syn_ratio),
                ],
                metadata: json!({
                    "source": source,
                    "target_count": targets.len(),
                    "syn_ratio": syn_ratio,
                }),
            });
        }
    }

    None
}

fn detect_data_staging(packets: &[PacketAnalysis]) -> Option<TrafficPattern> {
    let mut upload_bytes = 0;
    let mut download_bytes = 0;
    let mut staging_indicators = Vec::new();

    // Simple heuristic: look for asymmetric data flow
    for packet in packets {
        if let (Some(src), Some(_dst)) = (&packet.source_ip, &packet.dest_ip) {
            // Assuming internal IP pattern (simplified)
            if src.starts_with("192.168.") || src.starts_with("10.") || src.starts_with("172.") {
                upload_bytes += packet.payload_size;
            } else {
                download_bytes += packet.payload_size;
            }
        }
    }

    let ratio = if download_bytes > 0 {
        upload_bytes as f64 / download_bytes as f64
    } else {
        0.0
    };

    // High upload ratio might indicate data exfiltration
    if ratio > 10.0 && upload_bytes > 1_000_000 {
        staging_indicators.push(format!("High upload ratio: {:.2}", ratio));
        staging_indicators.push(format!("Total upload: {} bytes", upload_bytes));
        
        return Some(TrafficPattern {
            pattern_type: "Data Staging/Exfiltration".to_string(),
            confidence: (ratio / 20.0).min(0.9),
            matches: staging_indicators,
            metadata: json!({
                "upload_bytes": upload_bytes,
                "download_bytes": download_bytes,
                "ratio": ratio,
            }),
        });
    }

    None
}

fn detect_http_cc_pattern(packets: &[PacketAnalysis]) -> Option<CCPattern> {
    let mut http_indicators = Vec::new();
    let mut confidence: f64 = 0.0;

    // Look for HTTP traffic on non-standard ports
    for packet in packets {
        if packet.protocol == "TCP" {
            if let Some(port) = packet.dest_port {
                if port != 80 && port != 443 && port != 8080 {
                    // Check if this might be HTTP on non-standard port
                    if packet.payload_size > 100 {
                        http_indicators.push(format!("HTTP-like traffic on port {}", port));
                        confidence += 0.2;
                    }
                }
            }
        }
    }

    if !http_indicators.is_empty() {
        Some(CCPattern {
            pattern_type: "HTTP C&C".to_string(),
            confidence: confidence.min(0.8),
            indicators: http_indicators,
            iocs: vec![],
        })
    } else {
        None
    }
}

fn detect_dns_cc_pattern(packets: &[PacketAnalysis]) -> Option<CCPattern> {
    let mut dns_count = 0;
    let mut total_count = 0;
    let mut indicators = Vec::new();

    for packet in packets {
        if packet.protocol == "UDP" && packet.dest_port == Some(53) {
            dns_count += 1;
            
            // Large DNS queries might indicate tunneling
            if packet.payload_size > 200 {
                indicators.push("Large DNS query detected".to_string());
            }
        }
        total_count += 1;
    }

    let dns_ratio = dns_count as f64 / total_count as f64;
    
    // Excessive DNS traffic might indicate DNS tunneling
    if dns_ratio > 0.3 || !indicators.is_empty() {
        Some(CCPattern {
            pattern_type: "DNS Tunneling".to_string(),
            confidence: dns_ratio.min(0.9),
            indicators,
            iocs: vec![],
        })
    } else {
        None
    }
}

fn detect_encrypted_cc_pattern(packets: &[PacketAnalysis]) -> Option<CCPattern> {
    let mut encrypted_flows = 0;
    let mut total_flows = 0;
    let mut indicators = Vec::new();

    for packet in packets {
        if packet.protocol == "TCP" {
            total_flows += 1;
            
            // Check for TLS on non-standard ports
            if let Some(port) = packet.dest_port {
                if port != 443 && packet.payload_size > 0 {
                    // Simple heuristic for encrypted traffic
                    encrypted_flows += 1;
                    if port == 4444 || port == 8443 || port == 9443 {
                        indicators.push(format!("Encrypted traffic on suspicious port {}", port));
                    }
                }
            }
        }
    }

    if !indicators.is_empty() {
        // Calculate confidence based on the ratio of encrypted flows
        let encryption_ratio = if total_flows > 0 {
            encrypted_flows as f64 / total_flows as f64
        } else {
            0.0
        };
        
        Some(CCPattern {
            pattern_type: "Encrypted C&C".to_string(),
            confidence: (0.5 + encryption_ratio * 0.4).min(0.9),
            indicators,
            iocs: vec![],
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_beaconing_detection() {
        let packets = vec![
            PacketAnalysis {
                packet_type: "ethernet".to_string(),
                source_ip: Some("192.168.1.100".to_string()),
                dest_ip: Some("10.0.0.1".to_string()),
                source_port: Some(50000),
                dest_port: Some(443),
                protocol: "TCP".to_string(),
                payload_size: 100,
                flags: vec!["ACK".to_string()],
                timestamp: Some(1000),
            },
            PacketAnalysis {
                packet_type: "ethernet".to_string(),
                source_ip: Some("192.168.1.100".to_string()),
                dest_ip: Some("10.0.0.1".to_string()),
                source_port: Some(50000),
                dest_port: Some(443),
                protocol: "TCP".to_string(),
                payload_size: 100,
                flags: vec!["ACK".to_string()],
                timestamp: Some(6000),
            },
            // Add more packets for pattern detection...
        ];

        let beaconing = detect_beaconing(&packets);
        assert!(beaconing.is_none()); // Not enough packets for detection
    }
}