use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize)]
pub struct NetworkAnalysisInput {
    pub data: String, // Base64 encoded data
    pub length: usize,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkAnalysisResult {
    pub success: bool,
    pub network_indicators: Vec<NetworkIndicator>,
    pub urls: Vec<ExtractedUrl>,
    pub ip_addresses: Vec<IpAddress>,
    pub domains: Vec<Domain>,
    pub protocols: Vec<Protocol>,
    pub network_behaviors: Vec<NetworkBehavior>,
    pub c2_indicators: C2Analysis,
    pub risk_assessment: RiskAssessment,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkIndicator {
    pub indicator_type: String,
    pub value: String,
    pub offset: usize,
    pub context: String,
    pub threat_level: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractedUrl {
    pub url: String,
    pub protocol: String,
    pub domain: String,
    pub path: Option<String>,
    pub parameters: Option<String>,
    pub offset: usize,
    pub suspicious: bool,
    pub threat_intel_match: bool,
}

#[derive(Serialize, Deserialize)]
pub struct IpAddress {
    pub ip: String,
    pub version: String, // IPv4 or IPv6
    pub offset: usize,
    pub is_private: bool,
    pub is_loopback: bool,
    pub geolocation: Option<String>,
    pub reputation: String,
}

#[derive(Serialize, Deserialize)]
pub struct Domain {
    pub domain: String,
    pub tld: String,
    pub offset: usize,
    pub is_dga: bool, // Domain Generation Algorithm
    pub entropy: f64,
    pub suspicious: bool,
    pub age_days: Option<i32>,
}

#[derive(Serialize, Deserialize)]
pub struct Protocol {
    pub name: String,
    pub port: Option<u16>,
    pub indicators: Vec<String>,
    pub encrypted: bool,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkBehavior {
    pub behavior: String,
    pub description: String,
    pub confidence: f64,
    pub mitre_tactics: Vec<String>,
    pub evidence: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct C2Analysis {
    pub likely_c2: bool,
    pub c2_probability: f64,
    pub communication_patterns: Vec<String>,
    pub beacon_interval: Option<u32>,
    pub encryption_used: bool,
    pub protocols_used: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct RiskAssessment {
    pub overall_risk: String, // low, medium, high, critical
    pub risk_score: f64,
    pub risk_factors: Vec<String>,
    pub recommendations: Vec<String>,
}

#[wasm_bindgen]
pub fn analyze_network(input: &str) -> String {
    let parsed_input: Result<NetworkAnalysisInput, _> = serde_json::from_str(input);
    
    match parsed_input {
        Ok(input_data) => {
            // Decode base64 data
            let data = match general_purpose::STANDARD.decode(&input_data.data) {
                Ok(d) => d,
                Err(_) => {
                    return create_error_result("Failed to decode base64 data");
                }
            };
            
            // Extract network indicators
            let network_indicators = extract_network_indicators(&data);
            let urls = extract_urls(&data);
            let ip_addresses = extract_ip_addresses(&data);
            let domains = extract_domains(&data, &urls);
            let protocols = detect_protocols(&data);
            let network_behaviors = analyze_network_behaviors(&data, &urls, &ip_addresses);
            let c2_indicators = analyze_c2_indicators(&data, &urls, &domains, &network_behaviors);
            let risk_assessment = assess_risk(&network_indicators, &urls, &ip_addresses, 
                                            &domains, &c2_indicators);
            
            let result = NetworkAnalysisResult {
                success: true,
                network_indicators,
                urls,
                ip_addresses,
                domains,
                protocols,
                network_behaviors,
                c2_indicators,
                risk_assessment,
            };
            
            serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
        }
        Err(_) => {
            create_error_result("Failed to parse input")
        }
    }
}

fn create_error_result(error: &str) -> String {
    let result = NetworkAnalysisResult {
        success: false,
        network_indicators: vec![],
        urls: vec![],
        ip_addresses: vec![],
        domains: vec![],
        protocols: vec![],
        network_behaviors: vec![],
        c2_indicators: C2Analysis {
            likely_c2: false,
            c2_probability: 0.0,
            communication_patterns: vec![],
            beacon_interval: None,
            encryption_used: false,
            protocols_used: vec![],
        },
        risk_assessment: RiskAssessment {
            overall_risk: "unknown".to_string(),
            risk_score: 0.0,
            risk_factors: vec![error.to_string()],
            recommendations: vec![],
        },
    };
    
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

fn extract_network_indicators(data: &[u8]) -> Vec<NetworkIndicator> {
    let mut indicators = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // User-Agent strings
    let user_agents = vec![
        "Mozilla/5.0",
        "User-Agent:",
        "curl/",
        "Wget/",
        "python-requests/",
    ];
    
    for ua in user_agents {
        if let Some(offset) = find_string(&text, ua) {
            let context = extract_string_context(&text, offset, 50);
            indicators.push(NetworkIndicator {
                indicator_type: "User-Agent".to_string(),
                value: ua.to_string(),
                offset,
                context,
                threat_level: if ua.contains("curl") || ua.contains("Wget") { 
                    "medium".to_string() 
                } else { 
                    "low".to_string() 
                },
                tags: vec!["http".to_string(), "user-agent".to_string()],
            });
        }
    }
    
    // HTTP methods
    let http_methods = vec![
        ("GET ", "low"),
        ("POST ", "medium"),
        ("PUT ", "medium"),
        ("DELETE ", "medium"),
        ("CONNECT ", "high"),
        ("OPTIONS ", "low"),
    ];
    
    for (method, threat_level) in http_methods {
        if let Some(offset) = find_string(&text, method) {
            let context = extract_string_context(&text, offset, 50);
            indicators.push(NetworkIndicator {
                indicator_type: "HTTP Method".to_string(),
                value: method.trim().to_string(),
                offset,
                context,
                threat_level: threat_level.to_string(),
                tags: vec!["http".to_string(), "method".to_string()],
            });
        }
    }
    
    // Network API calls
    let network_apis = vec![
        ("socket", "Network Socket", "medium"),
        ("connect", "Network Connection", "medium"),
        ("send", "Data Transmission", "medium"),
        ("recv", "Data Reception", "medium"),
        ("InternetOpen", "WinINet API", "medium"),
        ("HttpOpenRequest", "HTTP Request", "medium"),
        ("WSAStartup", "Winsock Initialize", "medium"),
        ("getaddrinfo", "DNS Resolution", "low"),
        ("gethostbyname", "DNS Resolution", "low"),
    ];
    
    for (api, indicator_type, threat_level) in network_apis {
        if let Some(offset) = find_string(&text, api) {
            let context = extract_string_context(&text, offset, 30);
            indicators.push(NetworkIndicator {
                indicator_type: indicator_type.to_string(),
                value: api.to_string(),
                offset,
                context,
                threat_level: threat_level.to_string(),
                tags: vec!["api".to_string(), "network".to_string()],
            });
        }
    }
    
    indicators
}

fn extract_urls(data: &[u8]) -> Vec<ExtractedUrl> {
    let mut urls = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // Simple URL extraction (in production, use proper regex)
    let protocols = vec!["http://", "https://", "ftp://", "tcp://", "udp://"];
    
    for protocol in protocols {
        let mut search_start = 0;
        while let Some(offset) = find_string_from(&text, protocol, search_start) {
            // Extract URL until whitespace or null
            let url_start = offset;
            let mut url_end = url_start + protocol.len();
            
            let bytes = text.as_bytes();
            while url_end < bytes.len() && 
                  bytes[url_end] > 32 && 
                  bytes[url_end] != b'"' && 
                  bytes[url_end] != b'\'' &&
                  bytes[url_end] != b'>' {
                url_end += 1;
            }
            
            let url = text[url_start..url_end].to_string();
            
            // Parse URL components
            let domain = extract_domain_from_url(&url);
            let path = extract_path_from_url(&url);
            let parameters = extract_parameters_from_url(&url);
            
            // Check if suspicious
            let suspicious = is_suspicious_url(&url, &domain);
            let threat_intel_match = check_threat_intel(&domain);
            
            urls.push(ExtractedUrl {
                url: url.clone(),
                protocol: protocol.trim_end_matches("://").to_string(),
                domain: domain.clone(),
                path,
                parameters,
                offset: url_start,
                suspicious,
                threat_intel_match,
            });
            
            search_start = url_end;
        }
    }
    
    urls
}

fn extract_ip_addresses(data: &[u8]) -> Vec<IpAddress> {
    let mut ips = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // IPv4 pattern (simplified)
    let mut pos = 0;
    while pos < text.len() {
        if let Some(ip_match) = find_ipv4_at(&text, pos) {
            let (ip, offset, end) = ip_match;
            
            let is_private = is_private_ip(&ip);
            let is_loopback = ip.starts_with("127.");
            let reputation = if is_private || is_loopback {
                "safe".to_string()
            } else {
                check_ip_reputation(&ip)
            };
            
            ips.push(IpAddress {
                ip: ip.clone(),
                version: "IPv4".to_string(),
                offset,
                is_private,
                is_loopback,
                geolocation: if !is_private && !is_loopback { 
                    Some("Unknown".to_string()) 
                } else { 
                    None 
                },
                reputation,
            });
            
            pos = end;
        } else {
            break;
        }
    }
    
    // IPv6 pattern (simplified - just look for :: patterns)
    if text.contains("::") {
        // Add basic IPv6 detection
        ips.push(IpAddress {
            ip: "::1".to_string(),
            version: "IPv6".to_string(),
            offset: 0,
            is_private: false,
            is_loopback: true,
            geolocation: None,
            reputation: "safe".to_string(),
        });
    }
    
    ips
}

fn extract_domains(data: &[u8], urls: &[ExtractedUrl]) -> Vec<Domain> {
    let mut domains = Vec::new();
    let mut seen_domains = std::collections::HashSet::new();
    
    // Extract domains from URLs
    for url in urls {
        if !seen_domains.contains(&url.domain) {
            seen_domains.insert(url.domain.clone());
            
            let tld = extract_tld(&url.domain);
            let is_dga = is_likely_dga(&url.domain);
            let entropy = calculate_domain_entropy(&url.domain);
            let suspicious = is_suspicious_domain(&url.domain);
            
            domains.push(Domain {
                domain: url.domain.clone(),
                tld,
                offset: url.offset,
                is_dga,
                entropy,
                suspicious,
                age_days: None, // Would require external lookup
            });
        }
    }
    
    // Also look for standalone domains in the data
    let text = String::from_utf8_lossy(data);
    let common_tlds = vec![".com", ".net", ".org", ".io", ".ru", ".cn", ".tk"];
    
    for tld in common_tlds {
        let mut search_start = 0;
        while let Some(tld_pos) = find_string_from(&text, tld, search_start) {
            // Extract domain by going backwards
            let mut domain_start = tld_pos;
            while domain_start > 0 {
                let ch = text.as_bytes()[domain_start - 1];
                if !is_domain_char(ch) {
                    break;
                }
                domain_start -= 1;
            }
            
            let domain_end = tld_pos + tld.len();
            let domain = text[domain_start..domain_end].to_string();
            
            if domain.len() > tld.len() + 1 && !seen_domains.contains(&domain) {
                seen_domains.insert(domain.clone());
                
                let is_dga = is_likely_dga(&domain);
                let entropy = calculate_domain_entropy(&domain);
                let suspicious = is_suspicious_domain(&domain);
                
                domains.push(Domain {
                    domain: domain.clone(),
                    tld: tld.to_string(),
                    offset: domain_start,
                    is_dga,
                    entropy,
                    suspicious,
                    age_days: None,
                });
            }
            
            search_start = domain_end;
        }
    }
    
    domains
}

fn detect_protocols(data: &[u8]) -> Vec<Protocol> {
    let mut protocols = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // Common protocols and their indicators
    let protocol_indicators = vec![
        ("HTTP", vec!["GET ", "POST ", "HTTP/1.", "Host:"], Some(80), false),
        ("HTTPS", vec!["https://", "443", "TLS", "SSL"], Some(443), true),
        ("FTP", vec!["USER ", "PASS ", "PORT ", "PASV"], Some(21), false),
        ("SSH", vec!["ssh", "22", "openssh"], Some(22), true),
        ("Telnet", vec!["telnet", "23"], Some(23), false),
        ("SMTP", vec!["HELO ", "MAIL FROM:", "RCPT TO:"], Some(25), false),
        ("DNS", vec!["53", "nslookup", "dig"], Some(53), false),
        ("IRC", vec!["NICK ", "JOIN ", "PRIVMSG", "6667"], Some(6667), false),
        ("RDP", vec!["3389", "mstsc"], Some(3389), false),
        ("SMB", vec!["445", "139", "\\\\", "IPC$"], Some(445), false),
    ];
    
    for (name, indicators, port, encrypted) in protocol_indicators {
        let found_indicators: Vec<String> = indicators.iter()
            .filter(|&&ind| text.contains(ind))
            .map(|&s| s.to_string())
            .collect();
        
        if !found_indicators.is_empty() {
            protocols.push(Protocol {
                name: name.to_string(),
                port,
                indicators: found_indicators,
                encrypted,
            });
        }
    }
    
    protocols
}

fn analyze_network_behaviors(
    data: &[u8], 
    urls: &[ExtractedUrl], 
    ips: &[IpAddress]
) -> Vec<NetworkBehavior> {
    let mut behaviors = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // Check for data exfiltration patterns
    if text.contains("POST") && (text.contains("upload") || text.contains("send")) {
        behaviors.push(NetworkBehavior {
            behavior: "Data Exfiltration".to_string(),
            description: "Potential data upload capability detected".to_string(),
            confidence: 0.7,
            mitre_tactics: vec!["T1041".to_string(), "T1048".to_string()],
            evidence: vec!["POST method".to_string(), "Upload indicators".to_string()],
        });
    }
    
    // Check for C2 communication patterns
    if urls.len() > 3 || (urls.len() > 0 && text.contains("beacon")) {
        behaviors.push(NetworkBehavior {
            behavior: "C2 Communication".to_string(),
            description: "Potential command and control communication".to_string(),
            confidence: 0.6,
            mitre_tactics: vec!["T1071".to_string(), "T1095".to_string()],
            evidence: vec![format!("{} URLs found", urls.len())],
        });
    }
    
    // Check for download capability
    if text.contains("URLDownloadToFile") || text.contains("wget") || text.contains("curl") {
        behaviors.push(NetworkBehavior {
            behavior: "Download Capability".to_string(),
            description: "Can download files from remote servers".to_string(),
            confidence: 0.9,
            mitre_tactics: vec!["T1105".to_string()],
            evidence: vec!["Download functions detected".to_string()],
        });
    }
    
    // Check for proxy/tunnel behavior
    if text.contains("SOCKS") || text.contains("proxy") || text.contains("tunnel") {
        behaviors.push(NetworkBehavior {
            behavior: "Proxy/Tunnel Usage".to_string(),
            description: "May use proxy servers or create tunnels".to_string(),
            confidence: 0.7,
            mitre_tactics: vec!["T1090".to_string()],
            evidence: vec!["Proxy-related strings found".to_string()],
        });
    }
    
    // Check for DNS tunneling
    if text.contains("dns") && text.contains("txt") && text.contains("query") {
        behaviors.push(NetworkBehavior {
            behavior: "DNS Tunneling".to_string(),
            description: "Potential DNS tunneling capability".to_string(),
            confidence: 0.5,
            mitre_tactics: vec!["T1071.004".to_string()],
            evidence: vec!["DNS query patterns".to_string()],
        });
    }
    
    // Check for port scanning
    if ips.len() > 10 || text.contains("SYN") || text.contains("port scan") {
        behaviors.push(NetworkBehavior {
            behavior: "Network Scanning".to_string(),
            description: "May perform network reconnaissance".to_string(),
            confidence: 0.6,
            mitre_tactics: vec!["T1046".to_string()],
            evidence: vec![format!("{} IP addresses found", ips.len())],
        });
    }
    
    behaviors
}

fn analyze_c2_indicators(
    data: &[u8],
    urls: &[ExtractedUrl],
    domains: &[Domain],
    behaviors: &[NetworkBehavior],
) -> C2Analysis {
    let text = String::from_utf8_lossy(data);
    
    // Calculate C2 probability based on various factors
    let mut c2_score = 0.0;
    let mut patterns = Vec::new();
    
    // Check for suspicious domains
    let suspicious_domains = domains.iter().filter(|d| d.suspicious || d.is_dga).count();
    if suspicious_domains > 0 {
        c2_score += 0.3;
        patterns.push("Suspicious domains detected".to_string());
    }
    
    // Check for beacon-like patterns
    if text.contains("sleep") || text.contains("Sleep") || text.contains("interval") {
        c2_score += 0.2;
        patterns.push("Beacon timing patterns".to_string());
    }
    
    // Check for encryption indicators
    let encryption_used = text.contains("encrypt") || text.contains("AES") || 
                         text.contains("TLS") || text.contains("SSL");
    if encryption_used {
        c2_score += 0.1;
        patterns.push("Encryption capabilities".to_string());
    }
    
    // Check for specific C2 behaviors
    let has_c2_behavior = behaviors.iter()
        .any(|b| b.behavior.contains("C2") || b.behavior.contains("Command"));
    if has_c2_behavior {
        c2_score += 0.3;
        patterns.push("C2 behavioral patterns".to_string());
    }
    
    // Detect protocols commonly used for C2
    let mut c2_protocols = Vec::new();
    if urls.iter().any(|u| u.protocol == "https") {
        c2_protocols.push("HTTPS".to_string());
    }
    if text.contains("dns") {
        c2_protocols.push("DNS".to_string());
    }
    if text.contains("icmp") {
        c2_protocols.push("ICMP".to_string());
    }
    
    C2Analysis {
        likely_c2: c2_score > 0.5,
        c2_probability: f64::min(c2_score * 100.0, 100.0),
        communication_patterns: patterns,
        beacon_interval: if text.contains("sleep") { Some(60) } else { None },
        encryption_used,
        protocols_used: c2_protocols,
    }
}

fn assess_risk(
    indicators: &[NetworkIndicator],
    urls: &[ExtractedUrl],
    ips: &[IpAddress],
    domains: &[Domain],
    c2: &C2Analysis,
) -> RiskAssessment {
    let mut risk_score = 0.0;
    let mut risk_factors = Vec::new();
    
    // Factor in network indicators
    let high_risk_indicators = indicators.iter()
        .filter(|i| i.threat_level == "high")
        .count();
    risk_score += high_risk_indicators as f64 * 10.0;
    if high_risk_indicators > 0 {
        risk_factors.push(format!("{} high-risk network indicators", high_risk_indicators));
    }
    
    // Factor in suspicious URLs
    let suspicious_urls = urls.iter().filter(|u| u.suspicious).count();
    risk_score += suspicious_urls as f64 * 15.0;
    if suspicious_urls > 0 {
        risk_factors.push(format!("{} suspicious URLs", suspicious_urls));
    }
    
    // Factor in external IPs
    let external_ips = ips.iter()
        .filter(|ip| !ip.is_private && !ip.is_loopback)
        .count();
    risk_score += external_ips as f64 * 5.0;
    if external_ips > 0 {
        risk_factors.push(format!("{} external IP addresses", external_ips));
    }
    
    // Factor in DGA domains
    let dga_domains = domains.iter().filter(|d| d.is_dga).count();
    risk_score += dga_domains as f64 * 20.0;
    if dga_domains > 0 {
        risk_factors.push(format!("{} potential DGA domains", dga_domains));
    }
    
    // Factor in C2 indicators
    if c2.likely_c2 {
        risk_score += 30.0;
        risk_factors.push("Likely C2 communication detected".to_string());
    }
    
    // Determine overall risk level
    let overall_risk = if risk_score >= 70.0 {
        "critical"
    } else if risk_score >= 50.0 {
        "high"
    } else if risk_score >= 30.0 {
        "medium"
    } else {
        "low"
    };
    
    // Generate recommendations
    let mut recommendations = Vec::new();
    if overall_risk == "critical" || overall_risk == "high" {
        recommendations.push("Isolate the system immediately".to_string());
        recommendations.push("Perform deep packet inspection on network traffic".to_string());
    }
    if c2.likely_c2 {
        recommendations.push("Monitor for C2 communication patterns".to_string());
        recommendations.push("Block identified malicious domains and IPs".to_string());
    }
    if dga_domains > 0 {
        recommendations.push("Implement DGA detection at network level".to_string());
    }
    
    RiskAssessment {
        overall_risk: overall_risk.to_string(),
        risk_score: f64::min(risk_score, 100.0),
        risk_factors,
        recommendations,
    }
}

// Helper functions
fn find_string(text: &str, pattern: &str) -> Option<usize> {
    text.find(pattern)
}

fn find_string_from(text: &str, pattern: &str, start: usize) -> Option<usize> {
    text[start..].find(pattern).map(|pos| pos + start)
}

fn extract_string_context(text: &str, offset: usize, context_size: usize) -> String {
    let start = offset.saturating_sub(context_size / 2);
    let end = (offset + context_size / 2).min(text.len());
    
    text[start..end]
        .chars()
        .map(|c| if c.is_control() { '.' } else { c })
        .collect()
}

fn extract_domain_from_url(url: &str) -> String {
    // Remove protocol
    let without_protocol = url.split("://").nth(1).unwrap_or(url);
    
    // Extract domain (everything before first / or :)
    without_protocol
        .split(&['/', ':'][..])
        .next()
        .unwrap_or("")
        .to_string()
}

fn extract_path_from_url(url: &str) -> Option<String> {
    let without_protocol = url.split("://").nth(1).unwrap_or(url);
    
    if let Some(path_start) = without_protocol.find('/') {
        let path = &without_protocol[path_start..];
        let path_without_params = path.split('?').next().unwrap_or(path);
        if path_without_params.len() > 1 {
            return Some(path_without_params.to_string());
        }
    }
    
    None
}

fn extract_parameters_from_url(url: &str) -> Option<String> {
    if let Some(param_start) = url.find('?') {
        let params = &url[param_start + 1..];
        if !params.is_empty() {
            return Some(params.to_string());
        }
    }
    
    None
}

fn is_suspicious_url(url: &str, domain: &str) -> bool {
    // Check for suspicious patterns
    let suspicious_patterns = vec![
        "download", "payload", "exec", "cmd", "shell",
        "backdoor", "trojan", "malware", "virus",
    ];
    
    let lower_url = url.to_lowercase();
    if suspicious_patterns.iter().any(|&p| lower_url.contains(p)) {
        return true;
    }
    
    // Check for URL shorteners
    let shorteners = vec!["bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "t.co"];
    if shorteners.iter().any(|&s| domain.contains(s)) {
        return true;
    }
    
    // Check for suspicious TLDs
    let suspicious_tlds = vec![".tk", ".ml", ".ga", ".cf"];
    if suspicious_tlds.iter().any(|&tld| domain.ends_with(tld)) {
        return true;
    }
    
    // Check for IP addresses instead of domains
    if is_ip_address(domain) {
        return true;
    }
    
    false
}

fn check_threat_intel(domain: &str) -> bool {
    // Simulated threat intelligence check
    let known_bad_domains = vec![
        "malicious.com",
        "evil.net",
        "badactor.org",
    ];
    
    known_bad_domains.iter().any(|&bad| domain.contains(bad))
}

fn find_ipv4_at(text: &str, start: usize) -> Option<(String, usize, usize)> {
    let bytes = text[start..].as_bytes();
    let mut i = 0;
    
    while i < bytes.len() {
        // Look for digit
        if bytes[i].is_ascii_digit() {
            let ip_start = start + i;
            let mut octets = Vec::new();
            let mut current_octet = String::new();
            let mut j = i;
            
            while j < bytes.len() && octets.len() < 4 {
                if bytes[j].is_ascii_digit() {
                    current_octet.push(bytes[j] as char);
                    if current_octet.len() > 3 {
                        break;
                    }
                } else if bytes[j] == b'.' && !current_octet.is_empty() {
                    if let Ok(num) = current_octet.parse::<u32>() {
                        if num <= 255 {
                            octets.push(num);
                            current_octet.clear();
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                } else {
                    // End of potential IP
                    if !current_octet.is_empty() && octets.len() == 3 {
                        if let Ok(num) = current_octet.parse::<u32>() {
                            if num <= 255 {
                                octets.push(num);
                            }
                        }
                    }
                    break;
                }
                j += 1;
            }
            
            // Check if we have a valid IP
            if octets.len() == 4 {
                let ip = format!("{}.{}.{}.{}", octets[0], octets[1], octets[2], octets[3]);
                return Some((ip, ip_start, start + j));
            }
        }
        i += 1;
    }
    
    None
}

fn is_private_ip(ip: &str) -> bool {
    let octets: Vec<&str> = ip.split('.').collect();
    if octets.len() != 4 {
        return false;
    }
    
    if let Ok(first) = octets[0].parse::<u32>() {
        if let Ok(second) = octets[1].parse::<u32>() {
            return (first == 10) ||
                   (first == 172 && second >= 16 && second <= 31) ||
                   (first == 192 && second == 168);
        }
    }
    
    false
}

fn check_ip_reputation(ip: &str) -> String {
    // Simulated reputation check
    if ip.starts_with("185.") || ip.starts_with("45.") {
        "suspicious".to_string()
    } else {
        "unknown".to_string()
    }
}

fn extract_tld(domain: &str) -> String {
    if let Some(last_dot) = domain.rfind('.') {
        domain[last_dot..].to_string()
    } else {
        String::new()
    }
}

fn is_likely_dga(domain: &str) -> bool {
    // Simple DGA detection based on entropy and characteristics
    let parts: Vec<&str> = domain.split('.').collect();
    if parts.len() < 2 {
        return false;
    }
    
    let main_part = parts[0];
    
    // Check length
    if main_part.len() > 15 {
        return true;
    }
    
    // Check for high consonant to vowel ratio
    let vowels = "aeiouAEIOU";
    let vowel_count = main_part.chars().filter(|c| vowels.contains(*c)).count();
    let consonant_count = main_part.len() - vowel_count;
    
    if consonant_count > 0 && (vowel_count as f64 / consonant_count as f64) < 0.3 {
        return true;
    }
    
    // Check entropy
    calculate_domain_entropy(domain) > 3.5
}

fn calculate_domain_entropy(domain: &str) -> f64 {
    let main_part = domain.split('.').next().unwrap_or(domain);
    
    let mut freq = std::collections::HashMap::new();
    for ch in main_part.chars() {
        *freq.entry(ch).or_insert(0) += 1;
    }
    
    let len = main_part.len() as f64;
    let mut entropy = 0.0;
    
    for &count in freq.values() {
        let p = count as f64 / len;
        entropy -= p * p.log2();
    }
    
    entropy
}

fn is_suspicious_domain(domain: &str) -> bool {
    // Check for suspicious patterns
    let suspicious_patterns = vec![
        "malware", "virus", "trojan", "backdoor",
        "c2", "command", "control", "bot",
        "update", "download", "temp", "tmp",
    ];
    
    let lower_domain = domain.to_lowercase();
    suspicious_patterns.iter().any(|&p| lower_domain.contains(p))
}

fn is_domain_char(ch: u8) -> bool {
    ch.is_ascii_alphanumeric() || ch == b'-' || ch == b'.'
}

fn is_ip_address(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    
    parts.iter().all(|part| {
        part.parse::<u32>().map(|n| n <= 255).unwrap_or(false)
    })
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}