use anyhow::{Result, anyhow};
use std::net::IpAddr;

pub fn is_private_ip(ip: &str) -> bool {
    match ip.parse::<IpAddr>() {
        Ok(IpAddr::V4(ipv4)) => {
            ipv4.is_private() || ipv4.is_loopback() || ipv4.is_link_local()
        }
        Ok(IpAddr::V6(ipv6)) => {
            ipv6.is_loopback() || ipv6.is_unique_local() || ipv6.is_unspecified()
        }
        Err(_) => false,
    }
}

pub fn is_reserved_port(port: u16) -> bool {
    // Well-known ports (0-1023) are reserved
    port < 1024
}

pub fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let mut freq = [0u32; 256];
    
    // Count frequency of each byte
    for &byte in data {
        freq[byte as usize] += 1;
    }

    let len = data.len() as f64;
    let mut entropy = 0.0;

    // Calculate Shannon entropy
    for &count in &freq {
        if count > 0 {
            let p = count as f64 / len;
            entropy -= p * p.log2();
        }
    }

    entropy
}

pub fn extract_domain_from_sni(sni: &str) -> Option<String> {
    // Basic validation
    if sni.is_empty() || sni.contains(' ') {
        return None;
    }

    // Remove port if present
    let domain = if let Some(idx) = sni.rfind(':') {
        &sni[..idx]
    } else {
        sni
    };

    // Basic domain validation
    if domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.') {
        Some(domain.to_string())
    } else {
        None
    }
}

pub fn classify_port_service(port: u16) -> &'static str {
    match port {
        20 => "FTP-DATA",
        21 => "FTP",
        22 => "SSH",
        23 => "Telnet",
        25 => "SMTP",
        53 => "DNS",
        67 => "DHCP-Server",
        68 => "DHCP-Client",
        80 => "HTTP",
        110 => "POP3",
        119 => "NNTP",
        123 => "NTP",
        135 => "RPC",
        139 => "NetBIOS",
        143 => "IMAP",
        161 => "SNMP",
        194 => "IRC",
        443 => "HTTPS",
        445 => "SMB",
        465 => "SMTPS",
        514 => "Syslog",
        587 => "SMTP-Submission",
        631 => "IPP",
        853 => "DNS-over-TLS",
        993 => "IMAPS",
        995 => "POP3S",
        1080 => "SOCKS",
        1433 => "MSSQL",
        1434 => "MSSQL-Monitor",
        1521 => "Oracle",
        1723 => "PPTP",
        2049 => "NFS",
        2082 => "cPanel",
        2083 => "cPanel-SSL",
        3306 => "MySQL",
        3389 => "RDP",
        4444 => "Metasploit",
        5060 => "SIP",
        5432 => "PostgreSQL",
        5900 => "VNC",
        6379 => "Redis",
        8080 => "HTTP-Proxy",
        8443 => "HTTPS-Alt",
        8888 => "HTTP-Alt",
        9200 => "Elasticsearch",
        11211 => "Memcached",
        27017 => "MongoDB",
        _ => "Unknown",
    }
}

pub fn is_suspicious_domain(domain: &str) -> bool {
    // Check for common DGA patterns
    let parts: Vec<&str> = domain.split('.').collect();
    if parts.is_empty() {
        return false;
    }

    let subdomain = parts[0];
    
    // Check for high entropy (random-looking)
    if calculate_entropy(subdomain.as_bytes()) > 4.0 {
        return true;
    }

    // Check for suspicious TLDs
    let suspicious_tlds = vec![".tk", ".ml", ".ga", ".cf", ".click", ".download"];
    if suspicious_tlds.iter().any(|tld| domain.ends_with(tld)) {
        return true;
    }

    // Check for suspicious keywords
    let suspicious_keywords = vec!["malware", "ransomware", "phishing", "c2", "command"];
    let domain_lower = domain.to_lowercase();
    if suspicious_keywords.iter().any(|keyword| domain_lower.contains(keyword)) {
        return true;
    }

    false
}

pub fn format_bytes(bytes: usize) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    
    if bytes == 0 {
        return "0 B".to_string();
    }

    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

pub fn parse_cidr(cidr: &str) -> Result<(IpAddr, u8)> {
    let parts: Vec<&str> = cidr.split('/').collect();
    
    if parts.len() != 2 {
        return Err(anyhow!("Invalid CIDR notation"));
    }

    let ip = parts[0].parse::<IpAddr>()
        .map_err(|_| anyhow!("Invalid IP address"))?;
    
    let prefix = parts[1].parse::<u8>()
        .map_err(|_| anyhow!("Invalid prefix length"))?;

    // Validate prefix length
    match ip {
        IpAddr::V4(_) if prefix > 32 => {
            return Err(anyhow!("IPv4 prefix length must be <= 32"));
        }
        IpAddr::V6(_) if prefix > 128 => {
            return Err(anyhow!("IPv6 prefix length must be <= 128"));
        }
        _ => {}
    }

    Ok((ip, prefix))
}

pub fn ip_in_range(ip: &str, cidr: &str) -> Result<bool> {
    let test_ip = ip.parse::<IpAddr>()
        .map_err(|_| anyhow!("Invalid IP address"))?;
    
    let (range_ip, prefix_len) = parse_cidr(cidr)?;

    match (test_ip, range_ip) {
        (IpAddr::V4(test), IpAddr::V4(range)) => {
            let test_bits = u32::from(test);
            let range_bits = u32::from(range);
            let mask = !((1u32 << (32 - prefix_len)) - 1);
            
            Ok((test_bits & mask) == (range_bits & mask))
        }
        (IpAddr::V6(test), IpAddr::V6(range)) => {
            let test_bits = u128::from(test);
            let range_bits = u128::from(range);
            let mask = !((1u128 << (128 - prefix_len)) - 1);
            
            Ok((test_bits & mask) == (range_bits & mask))
        }
        _ => Ok(false), // Different IP versions don't match
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_private_ip() {
        assert!(is_private_ip("192.168.1.1"));
        assert!(is_private_ip("10.0.0.1"));
        assert!(is_private_ip("172.16.0.1"));
        assert!(is_private_ip("127.0.0.1"));
        assert!(!is_private_ip("8.8.8.8"));
        assert!(!is_private_ip("1.1.1.1"));
    }

    #[test]
    fn test_entropy_calculation() {
        let low_entropy = b"aaaaaaaaaa";
        let high_entropy = b"a1b2c3d4e5";
        
        assert!(calculate_entropy(low_entropy) < 1.0);
        assert!(calculate_entropy(high_entropy) > 2.0);
    }

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(1023), "1023 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1536), "1.50 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
    }

    #[test]
    fn test_ip_in_range() {
        assert!(ip_in_range("192.168.1.100", "192.168.1.0/24").unwrap());
        assert!(!ip_in_range("192.168.2.100", "192.168.1.0/24").unwrap());
        assert!(ip_in_range("10.0.0.50", "10.0.0.0/16").unwrap());
    }
}