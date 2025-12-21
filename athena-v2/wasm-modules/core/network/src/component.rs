// Component Model implementation for athena:network

wit_bindgen::generate!({
    world: "network-component",
    path: "wit",
});

use crate::packet;
use crate::protocols;
use crate::patterns;
use crate::anomaly;
use std::cell::RefCell;

// ============================================================================
// Component Implementation
// ============================================================================

struct Component;

// ============================================================================
// Network Analyzer Instance
// ============================================================================

struct NetworkAnalyzerInstance {
    initialized: bool,
    version: String,
}

impl NetworkAnalyzerInstance {
    fn new() -> Self {
        Self {
            initialized: true,
            version: "1.0.0".to_string(),
        }
    }

    fn analyze_packet_internal(&self, packet_data: &[u8]) -> std::result::Result<exports::athena::network::network::PacketAnalysis, String> {
        // Security: Validate packet size
        const MAX_PACKET_SIZE: usize = 65535; // Maximum IP packet size
        if packet_data.len() > MAX_PACKET_SIZE {
            return Err(format!("Packet too large: {} bytes", packet_data.len()));
        }

        let analysis = packet::analyze_packet(packet_data)
            .map_err(|e| e.to_string())?;

        Ok(exports::athena::network::network::PacketAnalysis {
            packet_type: analysis.packet_type,
            source_ip: analysis.source_ip,
            dest_ip: analysis.dest_ip,
            source_port: analysis.source_port,
            dest_port: analysis.dest_port,
            protocol: analysis.protocol,
            payload_size: analysis.payload_size as u64,
            packet_flags: analysis.flags,
            timestamp: analysis.timestamp,
        })
    }

    fn detect_protocol_internal(&self, data: &[u8]) -> std::result::Result<exports::athena::network::network::ProtocolInfo, String> {
        let protocol_info = protocols::detect_protocol(data)
            .map_err(|e| e.to_string())?;

        // Convert headers to JSON string
        let headers_json = serde_json::to_string(&protocol_info.headers)
            .unwrap_or_else(|_| "{}".to_string());

        Ok(exports::athena::network::network::ProtocolInfo {
            protocol_type: protocol_info.protocol_type,
            version: protocol_info.version,
            headers: headers_json,
            payload: protocol_info.payload,
            is_encrypted: protocol_info.is_encrypted,
        })
    }

    fn analyze_traffic_pattern_internal(&self, packets_json: &str) -> std::result::Result<Vec<exports::athena::network::network::TrafficPattern>, String> {
        let patterns = patterns::analyze_traffic_pattern(packets_json)
            .map_err(|e| e.to_string())?;

        Ok(patterns.into_iter().map(|p| {
            let metadata_json = serde_json::to_string(&p.metadata)
                .unwrap_or_else(|_| "{}".to_string());

            exports::athena::network::network::TrafficPattern {
                pattern_type: p.pattern_type,
                confidence: p.confidence,
                matches: p.matches,
                metadata: metadata_json,
            }
        }).collect())
    }

    fn detect_anomalies_internal(&self, traffic_data: &str) -> std::result::Result<Vec<exports::athena::network::network::NetworkAnomaly>, String> {
        let anomalies = anomaly::detect_anomalies(traffic_data)
            .map_err(|e| e.to_string())?;

        Ok(anomalies.into_iter().map(|a| {
            exports::athena::network::network::NetworkAnomaly {
                anomaly_type: a.anomaly_type,
                severity: a.severity,
                description: a.description,
                indicators: a.indicators,
                timestamp: a.timestamp,
            }
        }).collect())
    }

    fn get_version_internal(&self) -> String {
        self.version.clone()
    }

    fn is_initialized_internal(&self) -> bool {
        self.initialized
    }
}

// ============================================================================
// Network Interface Implementation
// ============================================================================

impl exports::athena::network::network::Guest for Component {
    type NetworkAnalyzer = NetworkAnalyzerResource;

    fn new() -> exports::athena::network::network::NetworkAnalyzer {
        exports::athena::network::network::NetworkAnalyzer::new(
            NetworkAnalyzerResource::new(NetworkAnalyzerInstance::new())
        )
    }

    fn analyze_packet(handle: exports::athena::network::network::NetworkAnalyzer, packet_data: Vec<u8>) -> std::result::Result<exports::athena::network::network::PacketAnalysis, String> {
        handle.get::<NetworkAnalyzerResource>().instance.borrow().analyze_packet_internal(&packet_data)
    }

    fn detect_protocol(handle: exports::athena::network::network::NetworkAnalyzer, data: Vec<u8>) -> std::result::Result<exports::athena::network::network::ProtocolInfo, String> {
        handle.get::<NetworkAnalyzerResource>().instance.borrow().detect_protocol_internal(&data)
    }

    fn analyze_traffic_pattern(handle: exports::athena::network::network::NetworkAnalyzer, packets_json: String) -> std::result::Result<Vec<exports::athena::network::network::TrafficPattern>, String> {
        handle.get::<NetworkAnalyzerResource>().instance.borrow().analyze_traffic_pattern_internal(&packets_json)
    }

    fn detect_anomalies(handle: exports::athena::network::network::NetworkAnalyzer, traffic_data: String) -> std::result::Result<Vec<exports::athena::network::network::NetworkAnomaly>, String> {
        handle.get::<NetworkAnalyzerResource>().instance.borrow().detect_anomalies_internal(&traffic_data)
    }

    fn get_version(handle: exports::athena::network::network::NetworkAnalyzer) -> String {
        handle.get::<NetworkAnalyzerResource>().instance.borrow().get_version_internal()
    }
}

// ============================================================================
// Network Analyzer Resource Implementation
// ============================================================================

struct NetworkAnalyzerResource {
    instance: RefCell<NetworkAnalyzerInstance>,
}

impl NetworkAnalyzerResource {
    fn new(instance: NetworkAnalyzerInstance) -> Self {
        Self {
            instance: RefCell::new(instance),
        }
    }
}

impl exports::athena::network::network::GuestNetworkAnalyzer for NetworkAnalyzerResource {
    fn new() -> Self {
        Self::new(NetworkAnalyzerInstance::new())
    }

    fn analyze_packet(&self, packet_data: Vec<u8>) -> std::result::Result<exports::athena::network::network::PacketAnalysis, String> {
        self.instance.borrow().analyze_packet_internal(&packet_data)
    }

    fn detect_protocol(&self, data: Vec<u8>) -> std::result::Result<exports::athena::network::network::ProtocolInfo, String> {
        self.instance.borrow().detect_protocol_internal(&data)
    }

    fn analyze_traffic_pattern(&self, packets_json: String) -> std::result::Result<Vec<exports::athena::network::network::TrafficPattern>, String> {
        self.instance.borrow().analyze_traffic_pattern_internal(&packets_json)
    }

    fn detect_anomalies(&self, traffic_data: String) -> std::result::Result<Vec<exports::athena::network::network::NetworkAnomaly>, String> {
        self.instance.borrow().detect_anomalies_internal(&traffic_data)
    }

    fn get_version(&self) -> String {
        self.instance.borrow().get_version_internal()
    }

    fn is_initialized(&self) -> bool {
        self.instance.borrow().is_initialized_internal()
    }
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);
