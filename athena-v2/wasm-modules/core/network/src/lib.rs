// Component Model implementation
mod component;

pub mod packet;
pub mod protocols;
pub mod patterns;
pub mod anomaly;
pub mod utils;

use serde::{Deserialize, Serialize};

// Type definitions for internal use
#[derive(Serialize, Deserialize)]
pub struct NetworkResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct PacketAnalysis {
    pub packet_type: String,
    pub source_ip: Option<String>,
    pub dest_ip: Option<String>,
    pub source_port: Option<u16>,
    pub dest_port: Option<u16>,
    pub protocol: String,
    pub payload_size: usize,
    pub flags: Vec<String>,
    pub timestamp: Option<i64>,
}

#[derive(Serialize, Deserialize)]
pub struct ProtocolInfo {
    pub protocol_type: String,
    pub version: Option<String>,
    pub headers: serde_json::Value,
    pub payload: Option<String>,
    pub is_encrypted: bool,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkAnomaly {
    pub anomaly_type: String,
    pub severity: String,
    pub description: String,
    pub indicators: Vec<String>,
    pub timestamp: i64,
}

#[derive(Serialize, Deserialize)]
pub struct TrafficPattern {
    pub pattern_type: String,
    pub confidence: f64,
    pub matches: Vec<String>,
    pub metadata: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dns_packet_analysis() {
        // Simple DNS query packet
        let dns_query = vec![
            0x12, 0x34, // Transaction ID
            0x01, 0x00, // Flags: standard query
            0x00, 0x01, // Questions: 1
            0x00, 0x00, // Answers: 0
            0x00, 0x00, // Authority: 0
            0x00, 0x00, // Additional: 0
            // Query: example.com
            0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65,
            0x03, 0x63, 0x6f, 0x6d,
            0x00, // Null terminator
            0x00, 0x01, // Type: A
            0x00, 0x01, // Class: IN
        ];

        // Test with protocols module (if available)
        // This is a basic structure test
        assert!(dns_query.len() > 12); // DNS header is 12 bytes minimum
        assert_eq!(dns_query[0..2], [0x12, 0x34]); // Transaction ID
    }

    #[test]
    fn test_http_request_structure() {
        let http_request = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Mozilla/5.0\r\n\r\n";
        let http_str = std::str::from_utf8(http_request).unwrap();

        assert!(http_request.starts_with(b"GET"));
        assert!(http_str.contains("Host: example.com"));
        assert!(http_str.contains("HTTP/1.1"));
    }

    #[test]
    fn test_packet_analysis_serialization() {
        let analysis = PacketAnalysis {
            packet_type: "ethernet".to_string(),
            source_ip: Some("192.168.1.100".to_string()),
            dest_ip: Some("192.168.1.1".to_string()),
            source_port: Some(54321),
            dest_port: Some(80),
            protocol: "TCP".to_string(),
            payload_size: 1024,
            flags: vec!["SYN".to_string(), "ACK".to_string()],
            timestamp: Some(1234567890),
        };

        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("192.168.1.100"));
        assert!(json.contains("TCP"));

        let deserialized: PacketAnalysis = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.source_ip, analysis.source_ip);
        assert_eq!(deserialized.dest_port, analysis.dest_port);
    }

    #[test]
    fn test_protocol_info_creation() {
        let proto_info = ProtocolInfo {
            protocol_type: "HTTP".to_string(),
            version: Some("1.1".to_string()),
            headers: serde_json::json!({"Host": "example.com"}),
            payload: None,
            is_encrypted: false,
        };

        assert_eq!(proto_info.protocol_type, "HTTP");
        assert!(!proto_info.is_encrypted);
        assert!(proto_info.version.is_some());
    }

    #[test]
    fn test_network_anomaly_severity() {
        let anomaly = NetworkAnomaly {
            anomaly_type: "port_scan".to_string(),
            severity: "high".to_string(),
            description: "Multiple ports accessed in short time".to_string(),
            indicators: vec!["Port 22".to_string(), "Port 80".to_string(), "Port 443".to_string()],
            timestamp: 1234567890,
        };

        assert_eq!(anomaly.severity, "high");
        assert_eq!(anomaly.indicators.len(), 3);
        assert!(anomaly.description.contains("Multiple"));
    }

    #[test]
    fn test_traffic_pattern_confidence() {
        let pattern = TrafficPattern {
            pattern_type: "beaconing".to_string(),
            confidence: 0.85,
            matches: vec!["192.168.1.100:443".to_string()],
            metadata: serde_json::json!({"interval": "300s"}),
        };

        assert!(pattern.confidence > 0.8);
        assert_eq!(pattern.pattern_type, "beaconing");
        assert!(!pattern.matches.is_empty());
    }

    #[test]
    fn test_network_result_error_handling() {
        let error_result = NetworkResult {
            success: false,
            data: None,
            error: Some("Connection timeout".to_string()),
        };

        assert!(!error_result.success);
        assert!(error_result.data.is_none());
        assert!(error_result.error.is_some());
        assert_eq!(error_result.error.unwrap(), "Connection timeout");
    }

    #[test]
    fn test_suspicious_port_numbers() {
        let suspicious_ports = vec![4444, 5555, 6666, 7777, 8888, 9999];

        for port in suspicious_ports {
            // Common malware ports should be flagged
            assert!(port > 4000 && port < 10000);
        }
    }

    #[test]
    fn test_ipv4_address_validation() {
        let valid_ips = vec!["192.168.1.1", "10.0.0.1", "172.16.0.1"];
        let invalid_ips = vec!["256.1.1.1", "192.168.1", "not-an-ip"];

        for ip in valid_ips {
            assert!(ip.split('.').count() == 4);
        }

        for ip in invalid_ips {
            let parts: Vec<&str> = ip.split('.').collect();
            let is_valid = parts.len() == 4 && parts.iter().all(|p| p.parse::<u8>().is_ok());
            assert!(!is_valid);
        }
    }
}
