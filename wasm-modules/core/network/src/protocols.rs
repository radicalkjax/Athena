use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use httparse;
use simple_dns::Packet;
use crate::ProtocolInfo;

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
    pub is_suspicious: bool,
}

pub fn detect_protocol(data: &[u8]) -> Result<ProtocolInfo> {
    // Try HTTP detection first
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
    
    // Check for TLS record header
    matches!(data[0], 0x16) && // Handshake
    matches!(data[1], 0x03) && // SSL 3.0 or TLS
    matches!(data[2], 0x00..=0x04) // TLS version
}

fn analyze_tls_handshake(data: &[u8]) -> Result<TlsInfo> {
    if !is_tls_handshake(data) {
        return Err(anyhow!("Not a TLS handshake"));
    }

    let mut tls_info = TlsInfo {
        version: match data[2] {
            0x00 => "SSL 3.0".to_string(),
            0x01 => "TLS 1.0".to_string(),
            0x02 => "TLS 1.1".to_string(),
            0x03 => "TLS 1.2".to_string(),
            0x04 => "TLS 1.3".to_string(),
            _ => "Unknown".to_string(),
        },
        handshake_type: None,
        server_name: None,
        cipher_suites: Vec::new(),
        is_suspicious: false,
    };

    // Check handshake type if we have enough data
    if data.len() > 5 {
        tls_info.handshake_type = Some(match data[5] {
            0x01 => "ClientHello".to_string(),
            0x02 => "ServerHello".to_string(),
            0x0b => "Certificate".to_string(),
            0x0c => "ServerKeyExchange".to_string(),
            0x0e => "ServerHelloDone".to_string(),
            0x10 => "ClientKeyExchange".to_string(),
            0x14 => "Finished".to_string(),
            _ => "Unknown".to_string(),
        });
    }

    // Try to extract SNI (Server Name Indication) from ClientHello
    if tls_info.handshake_type == Some("ClientHello".to_string()) {
        tls_info.server_name = extract_sni_from_client_hello(data);
    }

    Ok(tls_info)
}

fn extract_sni_from_client_hello(data: &[u8]) -> Option<String> {
    // This is a simplified SNI extraction
    // In production, you'd want a more robust parser
    if data.len() < 43 {
        return None;
    }

    // Skip to extensions (simplified)
    let mut pos = 43;
    while pos < data.len() - 4 {
        if data[pos] == 0x00 && data[pos + 1] == 0x00 {
            // Found SNI extension
            if pos + 9 < data.len() {
                let name_len = ((data[pos + 7] as usize) << 8) | (data[pos + 8] as usize);
                if pos + 9 + name_len <= data.len() {
                    return String::from_utf8(data[pos + 9..pos + 9 + name_len].to_vec()).ok();
                }
            }
        }
        pos += 1;
    }
    None
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
}