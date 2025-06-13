use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen;

pub mod packet;
pub mod protocols;
pub mod patterns;
pub mod anomaly;
pub mod utils;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

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

#[wasm_bindgen]
pub struct NetworkModule {
    initialized: bool,
}

#[wasm_bindgen]
impl NetworkModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<NetworkModule, JsValue> {
        console_log!("Initializing WASM Network Analysis Module");
        
        Ok(NetworkModule {
            initialized: true,
        })
    }
    
    #[wasm_bindgen]
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }
    
    #[wasm_bindgen]
    pub fn get_version(&self) -> String {
        "1.0.0".to_string()
    }
    
    // Packet analysis
    #[wasm_bindgen]
    pub fn analyze_packet(&self, packet_data: &[u8]) -> Result<JsValue, JsValue> {
        // Security: Validate packet size
        const MAX_PACKET_SIZE: usize = 65535; // Maximum IP packet size
        if packet_data.len() > MAX_PACKET_SIZE {
            return Err(JsValue::from_str(&format!("Packet too large: {} bytes", packet_data.len())));
        }
        
        match packet::analyze_packet(packet_data) {
            Ok(analysis) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(serde_json::to_value(&analysis).map_err(|e| JsValue::from_str(&e.to_string()))?),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // Protocol detection
    #[wasm_bindgen]
    pub fn detect_protocol(&self, data: &[u8]) -> Result<JsValue, JsValue> {
        match protocols::detect_protocol(data) {
            Ok(protocol_info) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(serde_json::to_value(&protocol_info).unwrap()),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // Pattern analysis
    #[wasm_bindgen]
    pub fn analyze_traffic_pattern(&self, packets_json: &str) -> Result<JsValue, JsValue> {
        match patterns::analyze_traffic_pattern(packets_json) {
            Ok(patterns) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(serde_json::to_value(&patterns).unwrap()),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // Anomaly detection
    #[wasm_bindgen]
    pub fn detect_anomalies(&self, traffic_data: &str) -> Result<JsValue, JsValue> {
        match anomaly::detect_anomalies(traffic_data) {
            Ok(anomalies) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(serde_json::to_value(&anomalies).unwrap()),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // DNS analysis
    #[wasm_bindgen]
    pub fn analyze_dns_query(&self, dns_packet: &[u8]) -> Result<JsValue, JsValue> {
        // Security: Validate DNS packet minimum size
        const MIN_DNS_SIZE: usize = 12; // DNS header size
        const MAX_DNS_SIZE: usize = 512; // Standard DNS UDP size
        
        if dns_packet.len() < MIN_DNS_SIZE {
            return Err(JsValue::from_str("DNS packet too small"));
        }
        if dns_packet.len() > MAX_DNS_SIZE {
            return Err(JsValue::from_str("DNS packet too large"));
        }
        
        match protocols::analyze_dns_packet(dns_packet) {
            Ok(dns_info) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(dns_info),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // HTTP analysis
    #[wasm_bindgen]
    pub fn analyze_http_request(&self, http_data: &[u8]) -> Result<JsValue, JsValue> {
        match protocols::analyze_http_request(http_data) {
            Ok(http_info) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(http_info),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // C&C detection
    #[wasm_bindgen]
    pub fn detect_cc_communication(&self, traffic_json: &str) -> Result<JsValue, JsValue> {
        match patterns::detect_cc_patterns(traffic_json) {
            Ok(cc_indicators) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(cc_indicators),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // Port scan detection
    #[wasm_bindgen]
    pub fn detect_port_scan(&self, packets_json: &str) -> Result<JsValue, JsValue> {
        match anomaly::detect_port_scan(packets_json) {
            Ok(scan_info) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(scan_info),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
    
    // Data exfiltration detection
    #[wasm_bindgen]
    pub fn detect_data_exfiltration(&self, traffic_json: &str) -> Result<JsValue, JsValue> {
        match anomaly::detect_data_exfiltration(traffic_json) {
            Ok(exfil_info) => {
                let result = NetworkResult {
                    success: true,
                    data: Some(exfil_info),
                    error: None,
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            Err(e) => {
                let result = NetworkResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
        }
    }
}

// Helper function for error handling
impl NetworkResult {
    pub fn ok(data: serde_json::Value) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn err(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}
