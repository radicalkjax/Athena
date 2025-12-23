use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use httparse;
use simple_dns::Packet;
use crate::ProtocolInfo;

// Protocol size limits for security
const MAX_DNS_PACKET_SIZE: usize = 512;           // Standard DNS UDP packet size
const MAX_HTTP_BODY_SIZE: usize = 10 * 1024 * 1024; // 10MB
const MAX_TLS_RECORD_SIZE: usize = 16 * 1024;     // 16KB per TLS record
const MAX_HTTP2_FRAME_SIZE: usize = 16 * 1024 * 1024; // 16MB (spec max)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpInfo {
    pub method: Option<String>,
    pub path: Option<String>,
    pub version: String,
    pub headers: Vec<(String, String)>,
    pub host: Option<String>,
    pub user_agent: Option<String>,
    pub content_length: Option<usize>,
    pub is_suspicious: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsInfo {
    pub query_type: String,
    pub questions: Vec<DnsQuestion>,
    pub answers: Vec<DnsAnswer>,
    pub is_suspicious: bool,
    pub suspicious_indicators: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsQuestion {
    pub name: String,
    pub record_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsAnswer {
    pub name: String,
    pub record_type: String,
    pub data: String,
    pub ttl: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsInfo {
    pub version: String,
    pub handshake_type: Option<String>,
    pub server_name: Option<String>,
    pub cipher_suites: Vec<String>,
    pub extensions: Vec<TlsExtension>,
    pub certificate_info: Option<CertificateInfo>,
    pub is_suspicious: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsExtension {
    pub extension_type: u16,
    pub name: String,
    pub data_length: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    pub subject: String,
    pub issuer: String,
    pub serial_number: String,
    pub not_before: Option<String>,
    pub not_after: Option<String>,
    pub public_key_algorithm: String,
    pub signature_algorithm: String,
    pub subject_alt_names: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct TlsRecord {
    pub content_type: u8,
    pub version: u16,
    pub length: u16,
    pub fragment: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct TlsHandshake {
    pub msg_type: u8,
    pub length: u32,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct ClientHello {
    pub version: u16,
    pub random: Vec<u8>,
    pub session_id: Vec<u8>,
    pub cipher_suites: Vec<u16>,
    pub compression_methods: Vec<u8>,
    pub extensions: Vec<TlsExtension>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Http2Info {
    pub version: String,
    pub frames: Vec<Http2FrameInfo>,
    pub streams: Vec<u32>,
    pub settings: Vec<(String, u32)>,
    pub is_suspicious: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Http2FrameInfo {
    pub frame_type: String,
    pub stream_id: u32,
    pub flags: u8,
    pub length: u32,
}

#[derive(Debug, Clone)]
pub struct Http2Frame {
    pub length: u32,
    pub frame_type: u8,
    pub flags: u8,
    pub stream_id: u32,
    pub payload: Vec<u8>,
}

pub fn detect_protocol(data: &[u8]) -> Result<ProtocolInfo> {
    // Try HTTP/2 detection first (more specific)
    if detect_http2(data) {
        if let Ok(http2_info) = analyze_http2_traffic(data) {
            return Ok(ProtocolInfo {
                protocol_type: "HTTP/2".to_string(),
                version: Some("2.0".to_string()),
                headers: json!(http2_info),
                payload: None,
                is_encrypted: false,
            });
        }
    }

    // Try HTTP detection
    if let Ok(http_info) = analyze_http_request(data) {
        return Ok(ProtocolInfo {
            protocol_type: "HTTP".to_string(),
            version: Some("1.1".to_string()),
            headers: http_info,
            payload: None,
            is_encrypted: false,
        });
    }

    // Try TLS detection
    if is_tls_handshake(data) {
        if let Ok(tls_info) = analyze_tls_handshake(data) {
            let version = tls_info.version.clone();
            return Ok(ProtocolInfo {
                protocol_type: "TLS".to_string(),
                version: Some(version),
                headers: json!(tls_info),
                payload: None,
                is_encrypted: true,
            });
        }
    }

    // Try DNS detection
    if let Ok(dns_info) = analyze_dns_packet(data) {
        return Ok(ProtocolInfo {
            protocol_type: "DNS".to_string(),
            version: None,
            headers: dns_info,
            payload: None,
            is_encrypted: false,
        });
    }

    // Default to unknown
    Ok(ProtocolInfo {
        protocol_type: "Unknown".to_string(),
        version: None,
        headers: json!({}),
        payload: Some(hex::encode(&data[..data.len().min(64)])),
        is_encrypted: false,
    })
}

pub fn analyze_http_request(data: &[u8]) -> Result<Value> {
    // Enforce HTTP request size limit
    if data.len() > MAX_HTTP_BODY_SIZE {
        return Err(anyhow!("HTTP request exceeds maximum size: {} > {}", data.len(), MAX_HTTP_BODY_SIZE));
    }

    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut req = httparse::Request::new(&mut headers);

    match req.parse(data) {
        Ok(httparse::Status::Complete(_)) | Ok(httparse::Status::Partial) => {
            let mut http_info = HttpInfo {
                method: req.method.map(|s| s.to_string()),
                path: req.path.map(|s| s.to_string()),
                version: format!("{}", req.version.unwrap_or(1)),
                headers: Vec::new(),
                host: None,
                user_agent: None,
                content_length: None,
                is_suspicious: false,
            };

            // Parse headers
            for header in req.headers.iter() {
                let name = header.name.to_lowercase();
                let value = String::from_utf8_lossy(header.value).to_string();
                
                http_info.headers.push((name.clone(), value.clone()));
                
                match name.as_str() {
                    "host" => http_info.host = Some(value),
                    "user-agent" => http_info.user_agent = Some(value),
                    "content-length" => http_info.content_length = value.parse().ok(),
                    _ => {}
                }
            }

            // Check for suspicious indicators
            http_info.is_suspicious = check_http_suspicious(&http_info);

            Ok(json!(http_info))
        }
        Err(_) => Err(anyhow!("Not a valid HTTP request")),
    }
}

pub fn analyze_dns_packet(data: &[u8]) -> Result<Value> {
    // Enforce DNS packet size limit
    if data.len() > MAX_DNS_PACKET_SIZE {
        return Err(anyhow!("DNS packet exceeds maximum size: {} > {}", data.len(), MAX_DNS_PACKET_SIZE));
    }

    match Packet::parse(data) {
        Ok(packet) => {
            let mut dns_info = DnsInfo {
                query_type: if packet.questions.is_empty() && !packet.answers.is_empty() {
                    "Response".to_string()
                } else {
                    "Query".to_string()
                },
                questions: Vec::new(),
                answers: Vec::new(),
                is_suspicious: false,
                suspicious_indicators: Vec::new(),
            };

            // Parse questions
            for question in &packet.questions {
                dns_info.questions.push(DnsQuestion {
                    name: question.qname.to_string(),
                    record_type: format!("{:?}", question.qtype),
                });
            }

            // Parse answers
            for answer in &packet.answers {
                dns_info.answers.push(DnsAnswer {
                    name: answer.name.to_string(),
                    record_type: format!("{:?}", answer.rdata.type_code()),
                    data: format!("{:?}", answer.rdata),
                    ttl: answer.ttl,
                });
            }

            // Check for suspicious DNS patterns
            check_dns_suspicious(&mut dns_info);

            Ok(json!(dns_info))
        }
        Err(_) => Err(anyhow!("Not a valid DNS packet")),
    }
}

fn is_tls_handshake(data: &[u8]) -> bool {
    if data.len() < 5 {
        return false;
    }

    // Check for TLS record header using safe indexing
    matches!(data.get(0), Some(&0x16)) && // Handshake
    matches!(data.get(1), Some(&0x03)) && // SSL 3.0 or TLS
    matches!(data.get(2), Some(&(0x00..=0x04))) // TLS version
}

fn analyze_tls_handshake(data: &[u8]) -> Result<TlsInfo> {
    if !is_tls_handshake(data) {
        return Err(anyhow!("Not a TLS handshake"));
    }

    // Parse TLS record
    let record = parse_tls_record(data)?;

    let mut tls_info = TlsInfo {
        version: tls_version_to_string(record.version),
        handshake_type: None,
        server_name: None,
        cipher_suites: Vec::new(),
        extensions: Vec::new(),
        certificate_info: None,
        is_suspicious: false,
    };

    // Parse handshake message
    if let Ok(handshake) = parse_tls_handshake(&record.fragment) {
        tls_info.handshake_type = Some(match handshake.msg_type {
            0x01 => "ClientHello".to_string(),
            0x02 => "ServerHello".to_string(),
            0x0b => "Certificate".to_string(),
            0x0c => "ServerKeyExchange".to_string(),
            0x0e => "ServerHelloDone".to_string(),
            0x10 => "ClientKeyExchange".to_string(),
            0x14 => "Finished".to_string(),
            _ => format!("Unknown(0x{:02x})", handshake.msg_type),
        });

        // Parse ClientHello for SNI, cipher suites, and extensions
        if handshake.msg_type == 0x01 {
            if let Ok(client_hello) = parse_client_hello(&handshake.body) {
                tls_info.cipher_suites = client_hello.cipher_suites
                    .iter()
                    .map(|cs| format!("0x{:04x}", cs))
                    .collect();
                tls_info.server_name = extract_sni(&client_hello);
                tls_info.extensions = client_hello.extensions;
            }
        }

        // Parse Certificate message
        if handshake.msg_type == 0x0b {
            if let Ok(cert_info) = parse_certificate(&handshake.body) {
                tls_info.certificate_info = Some(cert_info);
            }
        }
    }

    // Check for suspicious patterns
    tls_info.is_suspicious = check_tls_suspicious(&tls_info);

    Ok(tls_info)
}

fn check_http_suspicious(http_info: &HttpInfo) -> bool {
    let mut suspicious = false;

    // Check for suspicious user agents
    if let Some(ua) = &http_info.user_agent {
        let suspicious_agents = vec![
            "bot", "crawler", "spider", "scraper", "hack", "scan",
            "nikto", "sqlmap", "havij", "acunetix", "nessus"
        ];
        
        let ua_lower = ua.to_lowercase();
        if suspicious_agents.iter().any(|&agent| ua_lower.contains(agent)) {
            suspicious = true;
        }
    }

    // Check for suspicious paths
    if let Some(path) = &http_info.path {
        let suspicious_paths = vec![
            "admin", "wp-admin", "phpmyadmin", ".git", ".env",
            "config", "backup", ".sql", "shell", "cmd"
        ];
        
        let path_lower = path.to_lowercase();
        if suspicious_paths.iter().any(|&p| path_lower.contains(p)) {
            suspicious = true;
        }
    }

    // Check for missing host header (suspicious for HTTP/1.1)
    if http_info.version == "1" && http_info.host.is_none() {
        suspicious = true;
    }

    suspicious
}

fn check_dns_suspicious(dns_info: &mut DnsInfo) {
    // Check for DGA (Domain Generation Algorithm) patterns
    for question in &dns_info.questions {
        if is_dga_domain(&question.name) {
            dns_info.suspicious_indicators.push("Possible DGA domain".to_string());
            dns_info.is_suspicious = true;
        }

        // Check for DNS tunneling indicators
        if question.name.len() > 100 {
            dns_info.suspicious_indicators.push("Unusually long domain name".to_string());
            dns_info.is_suspicious = true;
        }

        // Check for suspicious TLDs
        let suspicious_tlds = vec![".tk", ".ml", ".ga", ".cf"];
        if suspicious_tlds.iter().any(|tld| question.name.ends_with(tld)) {
            dns_info.suspicious_indicators.push("Suspicious TLD".to_string());
            dns_info.is_suspicious = true;
        }
    }

    // Check for unusual record types that might indicate DNS tunneling
    for question in &dns_info.questions {
        if matches!(question.record_type.as_str(), "TXT" | "NULL" | "PRIVATE") {
            dns_info.suspicious_indicators.push("Unusual DNS record type".to_string());
            dns_info.is_suspicious = true;
        }
    }
}

fn is_dga_domain(domain: &str) -> bool {
    // Simple DGA detection based on entropy and characteristics
    let parts: Vec<&str> = domain.split('.').collect();
    if parts.len() < 2 {
        return false;
    }

    let subdomain = parts[0];
    
    // Check length
    if subdomain.len() < 10 || subdomain.len() > 50 {
        return false;
    }

    // Check for high consonant to vowel ratio
    let vowels = "aeiouAEIOU";
    let vowel_count = subdomain.chars().filter(|c| vowels.contains(*c)).count();
    let consonant_count = subdomain.len() - vowel_count;
    
    if consonant_count > vowel_count * 3 {
        return true;
    }

    // Check for random-looking patterns
    let has_numbers = subdomain.chars().any(|c| c.is_numeric());
    let has_letters = subdomain.chars().any(|c| c.is_alphabetic());
    
    has_numbers && has_letters && subdomain.len() > 15
}

// HTTP/2 Constants
const HTTP2_PREFACE: &[u8] = b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";

// HTTP/2 Frame Types
const FRAME_TYPE_DATA: u8 = 0x00;
const FRAME_TYPE_HEADERS: u8 = 0x01;
const FRAME_TYPE_PRIORITY: u8 = 0x02;
const FRAME_TYPE_RST_STREAM: u8 = 0x03;
const FRAME_TYPE_SETTINGS: u8 = 0x04;
const FRAME_TYPE_PUSH_PROMISE: u8 = 0x05;
const FRAME_TYPE_PING: u8 = 0x06;
const FRAME_TYPE_GOAWAY: u8 = 0x07;
const FRAME_TYPE_WINDOW_UPDATE: u8 = 0x08;
const FRAME_TYPE_CONTINUATION: u8 = 0x09;

// HTTP/2 Settings Parameters
const SETTINGS_HEADER_TABLE_SIZE: u16 = 0x01;
const SETTINGS_ENABLE_PUSH: u16 = 0x02;
const SETTINGS_MAX_CONCURRENT_STREAMS: u16 = 0x03;
const SETTINGS_INITIAL_WINDOW_SIZE: u16 = 0x04;
const SETTINGS_MAX_FRAME_SIZE: u16 = 0x05;
const SETTINGS_MAX_HEADER_LIST_SIZE: u16 = 0x06;

/// Detects if data starts with HTTP/2 connection preface
pub fn detect_http2(data: &[u8]) -> bool {
    data.starts_with(HTTP2_PREFACE)
}

/// Parses a single HTTP/2 frame from the data
pub fn parse_http2_frame(data: &[u8]) -> Option<Http2Frame> {
    if data.len() < 9 {
        return None;
    }

    // Parse frame header (9 bytes) using safe indexing
    let length = ((*data.get(0)? as u32) << 16) | ((*data.get(1)? as u32) << 8) | (*data.get(2)? as u32);
    let frame_type = *data.get(3)?;
    let flags = *data.get(4)?;

    // Safely construct stream_id bytes
    let stream_id = u32::from_be_bytes([
        data.get(5)? & 0x7f,
        *data.get(6)?,
        *data.get(7)?,
        *data.get(8)?
    ]);

    // Enforce size limit for HTTP/2 frames
    if length as usize > MAX_HTTP2_FRAME_SIZE {
        return None;
    }

    // Check if we have enough data for the payload
    if data.len() < 9 + length as usize {
        return None;
    }

    let payload = data[9..9 + length as usize].to_vec();

    Some(Http2Frame {
        length,
        frame_type,
        flags,
        stream_id,
        payload,
    })
}

/// Gets the frame type name
fn frame_type_to_string(frame_type: u8) -> String {
    match frame_type {
        FRAME_TYPE_DATA => "DATA".to_string(),
        FRAME_TYPE_HEADERS => "HEADERS".to_string(),
        FRAME_TYPE_PRIORITY => "PRIORITY".to_string(),
        FRAME_TYPE_RST_STREAM => "RST_STREAM".to_string(),
        FRAME_TYPE_SETTINGS => "SETTINGS".to_string(),
        FRAME_TYPE_PUSH_PROMISE => "PUSH_PROMISE".to_string(),
        FRAME_TYPE_PING => "PING".to_string(),
        FRAME_TYPE_GOAWAY => "GOAWAY".to_string(),
        FRAME_TYPE_WINDOW_UPDATE => "WINDOW_UPDATE".to_string(),
        FRAME_TYPE_CONTINUATION => "CONTINUATION".to_string(),
        _ => format!("UNKNOWN(0x{:02x})", frame_type),
    }
}

/// Parses HTTP/2 SETTINGS frame
fn parse_settings_frame(payload: &[u8]) -> Vec<(String, u32)> {
    let mut settings = Vec::new();

    // Each setting is 6 bytes (2 byte identifier + 4 byte value)
    for chunk in payload.chunks_exact(6) {
        let identifier = u16::from_be_bytes([chunk[0], chunk[1]]);
        let value = u32::from_be_bytes([chunk[2], chunk[3], chunk[4], chunk[5]]);

        let name = match identifier {
            SETTINGS_HEADER_TABLE_SIZE => "HEADER_TABLE_SIZE".to_string(),
            SETTINGS_ENABLE_PUSH => "ENABLE_PUSH".to_string(),
            SETTINGS_MAX_CONCURRENT_STREAMS => "MAX_CONCURRENT_STREAMS".to_string(),
            SETTINGS_INITIAL_WINDOW_SIZE => "INITIAL_WINDOW_SIZE".to_string(),
            SETTINGS_MAX_FRAME_SIZE => "MAX_FRAME_SIZE".to_string(),
            SETTINGS_MAX_HEADER_LIST_SIZE => "MAX_HEADER_LIST_SIZE".to_string(),
            _ => format!("UNKNOWN(0x{:04x})", identifier),
        };

        settings.push((name, value));
    }

    settings
}

/// Analyzes HTTP/2 traffic and extracts protocol information
pub fn analyze_http2_traffic(data: &[u8]) -> Result<Http2Info> {
    if !detect_http2(data) {
        return Err(anyhow!("Not HTTP/2 traffic"));
    }

    let mut http2_info = Http2Info {
        version: "2.0".to_string(),
        frames: Vec::new(),
        streams: Vec::new(),
        settings: Vec::new(),
        is_suspicious: false,
    };

    // Skip the preface
    let mut pos = HTTP2_PREFACE.len();

    // Parse frames
    while pos + 9 <= data.len() {
        if let Some(frame) = parse_http2_frame(&data[pos..]) {
            // Track unique stream IDs
            if frame.stream_id > 0 && !http2_info.streams.contains(&frame.stream_id) {
                http2_info.streams.push(frame.stream_id);
            }

            // Parse SETTINGS frame
            if frame.frame_type == FRAME_TYPE_SETTINGS {
                let settings = parse_settings_frame(&frame.payload);
                http2_info.settings.extend(settings);
            }

            // Add frame info
            http2_info.frames.push(Http2FrameInfo {
                frame_type: frame_type_to_string(frame.frame_type),
                stream_id: frame.stream_id,
                flags: frame.flags,
                length: frame.length,
            });

            pos += 9 + frame.length as usize;
        } else {
            break;
        }
    }

    // Check for suspicious patterns
    http2_info.is_suspicious = check_http2_suspicious(&http2_info);

    Ok(http2_info)
}

/// Checks for suspicious patterns in HTTP/2 traffic
fn check_http2_suspicious(http2_info: &Http2Info) -> bool {
    let mut suspicious = false;

    // Check for excessive number of streams (possible DoS attempt)
    if http2_info.streams.len() > 100 {
        suspicious = true;
    }

    // Check for unusual settings values
    for (name, value) in &http2_info.settings {
        match name.as_str() {
            "MAX_CONCURRENT_STREAMS" if *value > 1000 => suspicious = true,
            "MAX_FRAME_SIZE" if *value > 16777215 => suspicious = true, // Max allowed is 2^24-1
            "INITIAL_WINDOW_SIZE" if *value > 2147483647 => suspicious = true, // Max is 2^31-1
            _ => {}
        }
    }

    // Check for excessive RST_STREAM frames (possible connection disruption)
    let rst_count = http2_info.frames.iter()
        .filter(|f| f.frame_type == "RST_STREAM")
        .count();
    if rst_count > 50 {
        suspicious = true;
    }

    // Check for GOAWAY with error codes (potential issues)
    let goaway_count = http2_info.frames.iter()
        .filter(|f| f.frame_type == "GOAWAY")
        .count();
    if goaway_count > 5 {
        suspicious = true;
    }

    suspicious
}

/// Parse TLS record from raw data
pub fn parse_tls_record(data: &[u8]) -> Result<TlsRecord> {
    if data.len() < 5 {
        return Err(anyhow!("Data too short for TLS record"));
    }

    // Use safe indexing
    let content_type = *data.get(0).ok_or_else(|| anyhow!("Missing content type"))?;
    let version = u16::from_be_bytes([
        *data.get(1).ok_or_else(|| anyhow!("Missing version byte 1"))?,
        *data.get(2).ok_or_else(|| anyhow!("Missing version byte 2"))?
    ]);
    let length = u16::from_be_bytes([
        *data.get(3).ok_or_else(|| anyhow!("Missing length byte 1"))?,
        *data.get(4).ok_or_else(|| anyhow!("Missing length byte 2"))?
    ]) as usize;

    // Enforce TLS record size limit
    if length > MAX_TLS_RECORD_SIZE {
        return Err(anyhow!("TLS record exceeds maximum size: {} > {}", length, MAX_TLS_RECORD_SIZE));
    }

    if data.len() < 5 + length {
        return Err(anyhow!("Incomplete TLS record"));
    }

    Ok(TlsRecord {
        content_type,
        version,
        length: length as u16,
        fragment: data[5..5 + length].to_vec(),
    })
}

fn tls_version_to_string(version: u16) -> String {
    match version {
        0x0300 => "SSL 3.0".to_string(),
        0x0301 => "TLS 1.0".to_string(),
        0x0302 => "TLS 1.1".to_string(),
        0x0303 => "TLS 1.2".to_string(),
        0x0304 => "TLS 1.3".to_string(),
        _ => format!("Unknown(0x{:04x})", version),
    }
}

/// Parse TLS handshake message from fragment
fn parse_tls_handshake(data: &[u8]) -> Result<TlsHandshake> {
    if data.len() < 4 {
        return Err(anyhow!("Data too short for TLS handshake"));
    }

    // Use safe indexing
    let msg_type = *data.get(0).ok_or_else(|| anyhow!("Missing message type"))?;
    // Length is 24-bit big-endian
    let length = ((*data.get(1).ok_or_else(|| anyhow!("Missing length byte 1"))? as u32) << 16)
        | ((*data.get(2).ok_or_else(|| anyhow!("Missing length byte 2"))? as u32) << 8)
        | (*data.get(3).ok_or_else(|| anyhow!("Missing length byte 3"))? as u32);

    // Enforce handshake size limit (should fit within TLS record)
    if length as usize > MAX_TLS_RECORD_SIZE {
        return Err(anyhow!("TLS handshake exceeds maximum size"));
    }

    if data.len() < 4 + length as usize {
        return Err(anyhow!("Incomplete TLS handshake"));
    }

    Ok(TlsHandshake {
        msg_type,
        length,
        body: data[4..4 + length as usize].to_vec(),
    })
}

/// Parse ClientHello message
pub fn parse_client_hello(data: &[u8]) -> Result<ClientHello> {
    if data.len() < 38 {
        return Err(anyhow!("Data too short for ClientHello"));
    }

    let mut pos = 0;

    // Client version (2 bytes)
    let version = u16::from_be_bytes([data[pos], data[pos + 1]]);
    pos += 2;

    // Random (32 bytes)
    let random = data[pos..pos + 32].to_vec();
    pos += 32;

    // Session ID length (1 byte)
    let session_id_len = data[pos] as usize;
    pos += 1;

    if data.len() < pos + session_id_len {
        return Err(anyhow!("Incomplete session ID"));
    }

    // Session ID
    let session_id = data[pos..pos + session_id_len].to_vec();
    pos += session_id_len;

    // Cipher suites length (2 bytes)
    if data.len() < pos + 2 {
        return Err(anyhow!("Missing cipher suites length"));
    }
    let cipher_suites_len = u16::from_be_bytes([data[pos], data[pos + 1]]) as usize;
    pos += 2;

    if data.len() < pos + cipher_suites_len {
        return Err(anyhow!("Incomplete cipher suites"));
    }

    // Parse cipher suites (2 bytes each)
    let mut cipher_suites = Vec::new();
    for i in (0..cipher_suites_len).step_by(2) {
        if pos + i + 1 < data.len() {
            cipher_suites.push(u16::from_be_bytes([data[pos + i], data[pos + i + 1]]));
        }
    }
    pos += cipher_suites_len;

    // Compression methods length (1 byte)
    if data.len() < pos + 1 {
        return Err(anyhow!("Missing compression methods length"));
    }
    let compression_len = data[pos] as usize;
    pos += 1;

    if data.len() < pos + compression_len {
        return Err(anyhow!("Incomplete compression methods"));
    }

    let compression_methods = data[pos..pos + compression_len].to_vec();
    pos += compression_len;

    // Parse extensions if present
    let mut extensions = Vec::new();
    if data.len() > pos + 2 {
        let extensions_len = u16::from_be_bytes([data[pos], data[pos + 1]]) as usize;
        pos += 2;

        if data.len() >= pos + extensions_len {
            let ext_data = &data[pos..pos + extensions_len];
            extensions = parse_tls_extensions(ext_data);
        }
    }

    Ok(ClientHello {
        version,
        random,
        session_id,
        cipher_suites,
        compression_methods,
        extensions,
    })
}

/// Extract SNI from parsed ClientHello
pub fn extract_sni(client_hello: &ClientHello) -> Option<String> {
    for ext in &client_hello.extensions {
        if ext.extension_type == 0x0000 {
            // SNI extension - name is already extracted
            if !ext.name.is_empty() && ext.name != "server_name" {
                return Some(ext.name.clone());
            }
        }
    }
    None
}

/// Parse TLS extensions
fn parse_tls_extensions(data: &[u8]) -> Vec<TlsExtension> {
    let mut extensions = Vec::new();
    let mut pos = 0;

    while pos + 4 <= data.len() {
        let ext_type = u16::from_be_bytes([data[pos], data[pos + 1]]);
        let ext_len = u16::from_be_bytes([data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if pos + ext_len > data.len() {
            break;
        }

        let ext_data = &data[pos..pos + ext_len];
        let name = get_extension_name(ext_type, ext_data);

        extensions.push(TlsExtension {
            extension_type: ext_type,
            name,
            data_length: ext_len,
        });

        pos += ext_len;
    }

    extensions
}

/// Get human-readable extension name and extract SNI if applicable
fn get_extension_name(ext_type: u16, data: &[u8]) -> String {
    match ext_type {
        0x0000 => {
            // SNI - extract hostname using safe indexing
            if data.len() >= 5 {
                if let Some(&name_type) = data.get(2) {
                    if name_type == 0x00 {
                        // hostname
                        if let (Some(&len_hi), Some(&len_lo)) = (data.get(3), data.get(4)) {
                            let name_len = u16::from_be_bytes([len_hi, len_lo]) as usize;
                            if data.len() >= 5 + name_len {
                                if let Ok(hostname) = String::from_utf8(data[5..5 + name_len].to_vec()) {
                                    return hostname;
                                }
                            }
                        }
                    }
                }
            }
            "server_name".to_string()
        }
        0x0001 => "max_fragment_length".to_string(),
        0x0005 => "status_request".to_string(),
        0x000a => "supported_groups".to_string(),
        0x000b => "ec_point_formats".to_string(),
        0x000d => "signature_algorithms".to_string(),
        0x000f => "heartbeat".to_string(),
        0x0010 => "application_layer_protocol_negotiation".to_string(),
        0x0012 => "signed_certificate_timestamp".to_string(),
        0x0015 => "padding".to_string(),
        0x0016 => "encrypt_then_mac".to_string(),
        0x0017 => "extended_master_secret".to_string(),
        0x0023 => "session_ticket".to_string(),
        0x002b => "supported_versions".to_string(),
        0x002d => "psk_key_exchange_modes".to_string(),
        0x0033 => "key_share".to_string(),
        _ => format!("unknown(0x{:04x})", ext_type),
    }
}

/// Parse certificate message (simplified - does not do full X.509 parsing)
pub fn parse_certificate(data: &[u8]) -> Result<CertificateInfo> {
    if data.len() < 3 {
        return Err(anyhow!("Certificate data too short"));
    }

    // Certificates length (3 bytes) using safe indexing
    let certs_len = ((*data.get(0).ok_or_else(|| anyhow!("Missing cert length byte 1"))? as usize) << 16)
        | ((*data.get(1).ok_or_else(|| anyhow!("Missing cert length byte 2"))? as usize) << 8)
        | (*data.get(2).ok_or_else(|| anyhow!("Missing cert length byte 3"))? as usize);

    // Enforce reasonable certificate chain size limit
    if certs_len > MAX_TLS_RECORD_SIZE {
        return Err(anyhow!("Certificate chain exceeds maximum size"));
    }

    if data.len() < 3 + certs_len {
        return Err(anyhow!("Incomplete certificate chain"));
    }

    let mut pos = 3;

    // Parse first certificate (server certificate)
    if pos + 3 > data.len() {
        return Err(anyhow!("No certificates in chain"));
    }

    // Use safe indexing for certificate length
    let cert_len = ((*data.get(pos).ok_or_else(|| anyhow!("Missing cert length byte 1"))? as usize) << 16)
        | ((*data.get(pos + 1).ok_or_else(|| anyhow!("Missing cert length byte 2"))? as usize) << 8)
        | (*data.get(pos + 2).ok_or_else(|| anyhow!("Missing cert length byte 3"))? as usize);
    pos += 3;

    if pos + cert_len > data.len() {
        return Err(anyhow!("Incomplete certificate"));
    }

    let cert_data = &data[pos..pos + cert_len];

    // Basic X.509 parsing - this is simplified
    // In production, use a proper X.509 parser like x509-parser crate
    let cert_info = parse_x509_basic(cert_data)?;

    Ok(cert_info)
}

/// Basic X.509 certificate parsing (simplified)
fn parse_x509_basic(data: &[u8]) -> Result<CertificateInfo> {
    // This is a very simplified parser that extracts basic info
    // A production implementation should use the x509-parser crate

    // For now, return basic structure with hex-encoded serial
    let serial_number = if data.len() > 20 {
        hex::encode(&data[10..20])
    } else {
        "unknown".to_string()
    };

    Ok(CertificateInfo {
        subject: extract_dn_from_cert(data, "subject"),
        issuer: extract_dn_from_cert(data, "issuer"),
        serial_number,
        not_before: None,
        not_after: None,
        public_key_algorithm: "RSA".to_string(), // Simplified
        signature_algorithm: "SHA256withRSA".to_string(), // Simplified
        subject_alt_names: Vec::new(),
    })
}

/// Extract Distinguished Name from certificate (simplified)
fn extract_dn_from_cert(data: &[u8], _field: &str) -> String {
    // Simplified DN extraction
    // Look for common name patterns in the certificate
    let text = String::from_utf8_lossy(data);

    // Try to find CN= pattern
    if let Some(cn_start) = text.find("CN=") {
        let cn_part = &text[cn_start + 3..];
        if let Some(cn_end) = cn_part.find(|c: char| !c.is_alphanumeric() && c != '.' && c != '-' && c != '*') {
            return format!("CN={}", &cn_part[..cn_end]);
        }
    }

    "CN=unknown".to_string()
}

/// Check for suspicious TLS patterns
fn check_tls_suspicious(tls_info: &TlsInfo) -> bool {
    let mut suspicious = false;

    // Check for outdated/insecure TLS versions
    if matches!(tls_info.version.as_str(), "SSL 3.0" | "TLS 1.0" | "TLS 1.1") {
        suspicious = true;
    }

    // Check for weak cipher suites
    for cipher in &tls_info.cipher_suites {
        // RC4, DES, NULL ciphers are weak
        if cipher.contains("0x0000") || // NULL cipher
           cipher.contains("0x0001") || // NULL with MD5
           cipher.contains("0x0002") {  // NULL with SHA
            suspicious = true;
        }
    }

    // Check for missing SNI (common in malware)
    if tls_info.server_name.is_none() && tls_info.handshake_type == Some("ClientHello".to_string()) {
        suspicious = true;
    }

    // Check for self-signed or expired certificates
    if let Some(cert) = &tls_info.certificate_info {
        if cert.subject == cert.issuer {
            // Self-signed certificate
            suspicious = true;
        }
    }

    suspicious
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_http_detection() {
        let http_request = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let result = analyze_http_request(http_request);
        assert!(result.is_ok());
    }

    #[test]
    fn test_dga_detection() {
        assert!(is_dga_domain("x8k9m2n4p7q3r5t1.com"));
        assert!(!is_dga_domain("google.com"));
        assert!(!is_dga_domain("stackoverflow.com"));
    }

    #[test]
    fn test_tls_record_parsing() {
        // TLS 1.2 handshake record
        let tls_data = vec![
            0x16, // Content type: Handshake
            0x03, 0x03, // Version: TLS 1.2
            0x00, 0x05, // Length: 5 bytes
            0x01, 0x02, 0x03, 0x04, 0x05, // Fragment data
        ];

        let result = parse_tls_record(&tls_data);
        assert!(result.is_ok());

        let record = result.unwrap();
        assert_eq!(record.content_type, 0x16);
        assert_eq!(record.version, 0x0303);
        assert_eq!(record.length, 5);
        assert_eq!(record.fragment.len(), 5);
    }

    #[test]
    fn test_tls_version_string() {
        assert_eq!(tls_version_to_string(0x0300), "SSL 3.0");
        assert_eq!(tls_version_to_string(0x0301), "TLS 1.0");
        assert_eq!(tls_version_to_string(0x0302), "TLS 1.1");
        assert_eq!(tls_version_to_string(0x0303), "TLS 1.2");
        assert_eq!(tls_version_to_string(0x0304), "TLS 1.3");
    }

    #[test]
    fn test_client_hello_parsing() {
        // Minimal ClientHello structure
        let mut client_hello_data = Vec::new();
        client_hello_data.extend_from_slice(&[0x03, 0x03]); // Version: TLS 1.2
        client_hello_data.extend_from_slice(&[0u8; 32]); // Random (32 bytes)
        client_hello_data.push(0x00); // Session ID length: 0
        client_hello_data.extend_from_slice(&[0x00, 0x02]); // Cipher suites length: 2
        client_hello_data.extend_from_slice(&[0x00, 0x2f]); // Cipher: TLS_RSA_WITH_AES_128_CBC_SHA
        client_hello_data.push(0x01); // Compression methods length: 1
        client_hello_data.push(0x00); // Compression: NULL

        let result = parse_client_hello(&client_hello_data);
        assert!(result.is_ok());

        let hello = result.unwrap();
        assert_eq!(hello.version, 0x0303);
        assert_eq!(hello.random.len(), 32);
        assert_eq!(hello.cipher_suites.len(), 1);
        assert_eq!(hello.cipher_suites[0], 0x002f);
    }

    #[test]
    fn test_tls_extensions_parsing() {
        // Create extensions data with SNI
        let hostname = b"example.com";
        let mut ext_data = Vec::new();

        // Extension type: SNI (0x0000)
        ext_data.extend_from_slice(&[0x00, 0x00]);
        // Extension length
        let ext_len = (5 + hostname.len()) as u16;
        ext_data.extend_from_slice(&ext_len.to_be_bytes());
        // Server name list length
        let list_len = (3 + hostname.len()) as u16;
        ext_data.extend_from_slice(&list_len.to_be_bytes());
        // Name type: hostname (0x00)
        ext_data.push(0x00);
        // Hostname length
        ext_data.extend_from_slice(&(hostname.len() as u16).to_be_bytes());
        // Hostname
        ext_data.extend_from_slice(hostname);

        let extensions = parse_tls_extensions(&ext_data);
        assert_eq!(extensions.len(), 1);
        assert_eq!(extensions[0].extension_type, 0x0000);
        assert_eq!(extensions[0].name, "example.com");
    }

    #[test]
    fn test_sni_extraction() {
        // Create a ClientHello with SNI extension
        let mut extensions = Vec::new();
        extensions.push(TlsExtension {
            extension_type: 0x0000,
            name: "example.com".to_string(),
            data_length: 15,
        });

        let client_hello = ClientHello {
            version: 0x0303,
            random: vec![0u8; 32],
            session_id: Vec::new(),
            cipher_suites: vec![0x002f],
            compression_methods: vec![0x00],
            extensions,
        };

        let sni = extract_sni(&client_hello);
        assert!(sni.is_some());
        assert_eq!(sni.unwrap(), "example.com");
    }

    #[test]
    fn test_tls_suspicious_detection() {
        // Test old TLS version
        let mut tls_info = TlsInfo {
            version: "TLS 1.0".to_string(),
            handshake_type: Some("ClientHello".to_string()),
            server_name: Some("example.com".to_string()),
            cipher_suites: Vec::new(),
            extensions: Vec::new(),
            certificate_info: None,
            is_suspicious: false,
        };
        assert!(check_tls_suspicious(&tls_info));

        // Test weak cipher
        tls_info.version = "TLS 1.2".to_string();
        tls_info.cipher_suites = vec!["0x0000".to_string()]; // NULL cipher
        assert!(check_tls_suspicious(&tls_info));

        // Test missing SNI
        tls_info.cipher_suites = vec!["0x002f".to_string()];
        tls_info.server_name = None;
        assert!(check_tls_suspicious(&tls_info));

        // Test self-signed certificate
        tls_info.server_name = Some("example.com".to_string());
        tls_info.certificate_info = Some(CertificateInfo {
            subject: "CN=test".to_string(),
            issuer: "CN=test".to_string(), // Same as subject = self-signed
            serial_number: "123456".to_string(),
            not_before: None,
            not_after: None,
            public_key_algorithm: "RSA".to_string(),
            signature_algorithm: "SHA256withRSA".to_string(),
            subject_alt_names: Vec::new(),
        });
        assert!(check_tls_suspicious(&tls_info));

        // Test normal TLS
        tls_info.certificate_info.as_mut().unwrap().issuer = "CN=ca".to_string();
        assert!(!check_tls_suspicious(&tls_info));
    }

    #[test]
    fn test_http2_preface_detection() {
        let http2_preface = b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
        assert!(detect_http2(http2_preface));

        let not_http2 = b"GET / HTTP/1.1\r\n";
        assert!(!detect_http2(not_http2));
    }

    #[test]
    fn test_http2_frame_parsing() {
        // Create a simple SETTINGS frame
        let frame_data = vec![
            0x00, 0x00, 0x0c, // Length: 12 bytes (2 settings)
            0x04,             // Type: SETTINGS
            0x00,             // Flags: none
            0x00, 0x00, 0x00, 0x00, // Stream ID: 0
            // Setting 1: HEADER_TABLE_SIZE = 4096
            0x00, 0x01,       // Identifier
            0x00, 0x00, 0x10, 0x00, // Value: 4096
            // Setting 2: ENABLE_PUSH = 1
            0x00, 0x02,       // Identifier
            0x00, 0x00, 0x00, 0x01, // Value: 1
        ];

        let frame = parse_http2_frame(&frame_data).unwrap();
        assert_eq!(frame.length, 12);
        assert_eq!(frame.frame_type, FRAME_TYPE_SETTINGS);
        assert_eq!(frame.flags, 0);
        assert_eq!(frame.stream_id, 0);
        assert_eq!(frame.payload.len(), 12);
    }

    #[test]
    fn test_http2_settings_frame_parsing() {
        let settings_payload = vec![
            0x00, 0x01,       // HEADER_TABLE_SIZE
            0x00, 0x00, 0x10, 0x00, // Value: 4096
            0x00, 0x02,       // ENABLE_PUSH
            0x00, 0x00, 0x00, 0x01, // Value: 1
            0x00, 0x03,       // MAX_CONCURRENT_STREAMS
            0x00, 0x00, 0x00, 0x64, // Value: 100
        ];

        let settings = parse_settings_frame(&settings_payload);
        assert_eq!(settings.len(), 3);
        assert_eq!(settings[0].0, "HEADER_TABLE_SIZE");
        assert_eq!(settings[0].1, 4096);
        assert_eq!(settings[1].0, "ENABLE_PUSH");
        assert_eq!(settings[1].1, 1);
        assert_eq!(settings[2].0, "MAX_CONCURRENT_STREAMS");
        assert_eq!(settings[2].1, 100);
    }

    #[test]
    fn test_http2_traffic_analysis() {
        // Create HTTP/2 connection with preface and SETTINGS frame
        let mut http2_data = Vec::new();
        http2_data.extend_from_slice(b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

        // Add SETTINGS frame
        http2_data.extend_from_slice(&[
            0x00, 0x00, 0x06, // Length: 6 bytes
            0x04,             // Type: SETTINGS
            0x00,             // Flags: none
            0x00, 0x00, 0x00, 0x00, // Stream ID: 0
            0x00, 0x03,       // MAX_CONCURRENT_STREAMS
            0x00, 0x00, 0x00, 0x64, // Value: 100
        ]);

        let result = analyze_http2_traffic(&http2_data);
        assert!(result.is_ok());

        let http2_info = result.unwrap();
        assert_eq!(http2_info.version, "2.0");
        assert_eq!(http2_info.frames.len(), 1);
        assert_eq!(http2_info.frames[0].frame_type, "SETTINGS");
        assert_eq!(http2_info.settings.len(), 1);
        assert_eq!(http2_info.settings[0].0, "MAX_CONCURRENT_STREAMS");
        assert_eq!(http2_info.settings[0].1, 100);
    }

    #[test]
    fn test_http2_multiple_frames() {
        let mut http2_data = Vec::new();
        http2_data.extend_from_slice(b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

        // SETTINGS frame
        http2_data.extend_from_slice(&[
            0x00, 0x00, 0x00, // Length: 0
            0x04,             // Type: SETTINGS
            0x00,             // Flags: none
            0x00, 0x00, 0x00, 0x00, // Stream ID: 0
        ]);

        // HEADERS frame on stream 1
        http2_data.extend_from_slice(&[
            0x00, 0x00, 0x05, // Length: 5
            0x01,             // Type: HEADERS
            0x04,             // Flags: END_HEADERS
            0x00, 0x00, 0x00, 0x01, // Stream ID: 1
            0x01, 0x02, 0x03, 0x04, 0x05, // Dummy payload
        ]);

        let result = analyze_http2_traffic(&http2_data).unwrap();
        assert_eq!(result.frames.len(), 2);
        assert_eq!(result.frames[0].frame_type, "SETTINGS");
        assert_eq!(result.frames[1].frame_type, "HEADERS");
        assert_eq!(result.streams.len(), 1);
        assert!(result.streams.contains(&1));
    }

    #[test]
    fn test_http2_suspicious_detection() {
        let mut http2_info = Http2Info {
            version: "2.0".to_string(),
            frames: Vec::new(),
            streams: Vec::new(),
            settings: vec![
                ("MAX_CONCURRENT_STREAMS".to_string(), 2000), // Excessive
            ],
            is_suspicious: false,
        };

        assert!(check_http2_suspicious(&http2_info));

        // Test with normal values
        http2_info.settings[0].1 = 100;
        assert!(!check_http2_suspicious(&http2_info));
    }

    #[test]
    fn test_http2_frame_type_strings() {
        assert_eq!(frame_type_to_string(FRAME_TYPE_DATA), "DATA");
        assert_eq!(frame_type_to_string(FRAME_TYPE_HEADERS), "HEADERS");
        assert_eq!(frame_type_to_string(FRAME_TYPE_SETTINGS), "SETTINGS");
        assert_eq!(frame_type_to_string(FRAME_TYPE_GOAWAY), "GOAWAY");
        assert_eq!(frame_type_to_string(0xFF), "UNKNOWN(0xff)");
    }

    #[test]
    fn test_detect_protocol_http2() {
        let mut http2_data = Vec::new();
        http2_data.extend_from_slice(b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
        http2_data.extend_from_slice(&[
            0x00, 0x00, 0x00, // Length: 0
            0x04,             // Type: SETTINGS
            0x00,             // Flags: none
            0x00, 0x00, 0x00, 0x00, // Stream ID: 0
        ]);

        let result = detect_protocol(&http2_data).unwrap();
        assert_eq!(result.protocol_type, "HTTP/2");
        assert_eq!(result.version, Some("2.0".to_string()));
    }
}