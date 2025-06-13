use anyhow::{Result, anyhow};
use etherparse::{SlicedPacket, NetSlice, TransportSlice, LinkSlice};
use serde::{Deserialize, Serialize};
use crate::PacketAnalysis;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketInfo {
    pub ethernet: Option<EthernetInfo>,
    pub ip: Option<IpInfo>,
    pub transport: Option<TransportInfo>,
    pub payload_size: usize,
    pub total_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthernetInfo {
    pub source_mac: String,
    pub destination_mac: String,
    pub ether_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpInfo {
    pub version: u8,
    pub source: String,
    pub destination: String,
    pub protocol: String,
    pub ttl: Option<u8>,
    pub total_length: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportInfo {
    pub protocol: String,
    pub source_port: Option<u16>,
    pub destination_port: Option<u16>,
    pub flags: Vec<String>,
}

pub fn analyze_packet(data: &[u8]) -> Result<PacketAnalysis> {
    if data.len() < 14 {
        return Err(anyhow!("Packet too small to be valid"));
    }

    let mut analysis = PacketAnalysis {
        packet_type: "ethernet".to_string(),
        source_ip: None,
        dest_ip: None,
        source_port: None,
        dest_port: None,
        protocol: "unknown".to_string(),
        payload_size: 0,
        flags: Vec::new(),
        timestamp: Some(chrono::Utc::now().timestamp()),
    };

    match SlicedPacket::from_ethernet(data) {
        Ok(packet) => {
            // Process IP layer with simplified approach
            if let Some(net) = &packet.net {
                match net {
                    NetSlice::Ipv4(ipv4_slice) => {
                        // Extract source and destination using header methods
                        let header = ipv4_slice.header();
                        analysis.source_ip = Some(std::net::Ipv4Addr::from(header.source()).to_string());
                        analysis.dest_ip = Some(std::net::Ipv4Addr::from(header.destination()).to_string());
                        analysis.protocol = protocol_name(u8::from(header.protocol())).to_string();
                    }
                    NetSlice::Ipv6(ipv6_slice) => {
                        // Extract source and destination using header methods
                        let header = ipv6_slice.header();
                        analysis.source_ip = Some(std::net::Ipv6Addr::from(header.source()).to_string());
                        analysis.dest_ip = Some(std::net::Ipv6Addr::from(header.destination()).to_string());
                        analysis.protocol = protocol_name(u8::from(header.next_header())).to_string();
                    }
                }
            }

            // Process transport layer
            if let Some(transport) = &packet.transport {
                match transport {
                    TransportSlice::Tcp(tcp_slice) => {
                        analysis.protocol = "TCP".to_string();
                        // Extract ports using header methods
                        analysis.source_port = Some(tcp_slice.source_port());
                        analysis.dest_port = Some(tcp_slice.destination_port());
                        
                        // Extract flags from header
                        let header = tcp_slice.to_header();
                        let mut flags = Vec::new();
                        if header.fin { flags.push("FIN".to_string()); }
                        if header.syn { flags.push("SYN".to_string()); }
                        if header.rst { flags.push("RST".to_string()); }
                        if header.psh { flags.push("PSH".to_string()); }
                        if header.ack { flags.push("ACK".to_string()); }
                        if header.urg { flags.push("URG".to_string()); }
                        if header.ece { flags.push("ECE".to_string()); }
                        if header.cwr { flags.push("CWR".to_string()); }
                        analysis.flags = flags;
                    }
                    TransportSlice::Udp(udp_slice) => {
                        analysis.protocol = "UDP".to_string();
                        // Extract ports using header methods
                        analysis.source_port = Some(udp_slice.source_port());
                        analysis.dest_port = Some(udp_slice.destination_port());
                    }
                    TransportSlice::Icmpv4(_) => {
                        analysis.protocol = "ICMP".to_string();
                    }
                    TransportSlice::Icmpv6(_) => {
                        analysis.protocol = "ICMPv6".to_string();
                    }
                }
            }

            // Calculate payload size
            let header_size = 14 + // Ethernet
                packet.net.as_ref().map(|n| match n {
                    NetSlice::Ipv4(ipv4) => (ipv4.header().ihl() as usize) * 4, // IHL is in 32-bit words
                    NetSlice::Ipv6(_) => 40, // IPv6 header is always 40 bytes
                }).unwrap_or(0) +
                packet.transport.as_ref().map(|t| match t {
                    TransportSlice::Tcp(s) => s.to_header().data_offset() as usize * 4, // TCP data offset is in 32-bit words
                    TransportSlice::Udp(_) => 8, // UDP header is always 8 bytes
                    TransportSlice::Icmpv4(_) => 8, // ICMP header is typically 8 bytes
                    TransportSlice::Icmpv6(_) => 8, // ICMPv6 header is typically 8 bytes
                }).unwrap_or(0);
            
            analysis.payload_size = data.len().saturating_sub(header_size);

            Ok(analysis)
        }
        Err(e) => Err(anyhow!("Failed to parse packet: {}", e)),
    }
}

pub fn parse_packet_details(data: &[u8]) -> Result<PacketInfo> {
    let packet = SlicedPacket::from_ethernet(data)
        .map_err(|e| anyhow!("Failed to parse packet: {}", e))?;

    let ethernet = if let Some(eth) = &packet.link {
        match eth {
            LinkSlice::Ethernet2(eth_slice) => {
                let header = eth_slice.to_header();
                Some(EthernetInfo {
                    source_mac: format_mac(&header.source),
                    destination_mac: format_mac(&header.destination),
                    ether_type: format!("{:04x}", u16::from(header.ether_type)),
                })
            }
            _ => None,
        }
    } else {
        None
    };

    let ip = if let Some(net_slice) = &packet.net {
        match net_slice {
            NetSlice::Ipv4(ipv4_slice) => {
                let header = ipv4_slice.header();
                Some(IpInfo {
                    version: 4,
                    source: std::net::Ipv4Addr::from(header.source()).to_string(),
                    destination: std::net::Ipv4Addr::from(header.destination()).to_string(),
                    protocol: protocol_name(u8::from(header.protocol())).to_string(),
                    ttl: Some(header.ttl()),
                    total_length: Some(header.total_len()),
                })
            }
            NetSlice::Ipv6(ipv6_slice) => {
                let header = ipv6_slice.header();
                Some(IpInfo {
                    version: 6,
                    source: std::net::Ipv6Addr::from(header.source()).to_string(),
                    destination: std::net::Ipv6Addr::from(header.destination()).to_string(),
                    protocol: protocol_name(u8::from(header.next_header())).to_string(),
                    ttl: Some(header.hop_limit()),
                    total_length: Some(header.payload_length() + 40), // IPv6 header is 40 bytes
                })
            }
        }
    } else {
        None
    };

    let transport = if let Some(trans) = &packet.transport {
        match trans {
            TransportSlice::Tcp(tcp_slice) => {
                let header = tcp_slice.to_header();
                let mut flags = Vec::new();
                if header.fin { flags.push("FIN".to_string()); }
                if header.syn { flags.push("SYN".to_string()); }
                if header.rst { flags.push("RST".to_string()); }
                if header.psh { flags.push("PSH".to_string()); }
                if header.ack { flags.push("ACK".to_string()); }
                if header.urg { flags.push("URG".to_string()); }
                if header.ece { flags.push("ECE".to_string()); }
                if header.cwr { flags.push("CWR".to_string()); }
                
                Some(TransportInfo {
                    protocol: "TCP".to_string(),
                    source_port: Some(tcp_slice.source_port()),
                    destination_port: Some(tcp_slice.destination_port()),
                    flags,
                })
            }
            TransportSlice::Udp(udp_slice) => {
                Some(TransportInfo {
                    protocol: "UDP".to_string(),
                    source_port: Some(udp_slice.source_port()),
                    destination_port: Some(udp_slice.destination_port()),
                    flags: vec![],
                })
            }
            _ => None,
        }
    } else {
        None
    };

    // Calculate sizes
    let header_size = 14 + // Ethernet
        packet.net.as_ref().map(|n| match n {
            NetSlice::Ipv4(ipv4) => (ipv4.header().ihl() as usize) * 4, // IHL is in 32-bit words
            NetSlice::Ipv6(_) => 40, // IPv6 header is always 40 bytes
        }).unwrap_or(0) +
        packet.transport.as_ref().map(|t| match t {
            TransportSlice::Tcp(s) => s.to_header().data_offset() as usize * 4, // TCP data offset is in 32-bit words
            TransportSlice::Udp(_) => 8, // UDP header is always 8 bytes
            TransportSlice::Icmpv4(_) => 8, // ICMP header is typically 8 bytes
            TransportSlice::Icmpv6(_) => 8, // ICMPv6 header is typically 8 bytes
        }).unwrap_or(0);

    Ok(PacketInfo {
        ethernet,
        ip,
        transport,
        payload_size: data.len().saturating_sub(header_size),
        total_size: data.len(),
    })
}

fn format_mac(mac: &[u8; 6]) -> String {
    format!(
        "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
    )
}

fn protocol_name(proto: u8) -> &'static str {
    match proto {
        1 => "ICMP",
        6 => "TCP",
        17 => "UDP",
        41 => "IPv6",
        47 => "GRE",
        50 => "ESP",
        51 => "AH",
        58 => "ICMPv6",
        _ => "Unknown",
    }
}


// Check for suspicious packet characteristics
pub fn check_packet_anomalies(packet: &PacketAnalysis) -> Vec<String> {
    let mut anomalies = Vec::new();

    // Check for suspicious port combinations
    if let (Some(sport), Some(dport)) = (packet.source_port, packet.dest_port) {
        // Common malware ports
        let suspicious_ports = vec![135, 139, 445, 1433, 3389, 4444, 5555, 6666, 7777, 8888, 9999];
        if suspicious_ports.contains(&sport) || suspicious_ports.contains(&dport) {
            anomalies.push("Suspicious port detected".to_string());
        }

        // Check for port 0 (invalid)
        if sport == 0 || dport == 0 {
            anomalies.push("Invalid port 0 detected".to_string());
        }
    }

    // Check TCP flags anomalies
    if packet.protocol == "TCP" && !packet.flags.is_empty() {
        // SYN+FIN is invalid
        if packet.flags.contains(&"SYN".to_string()) && packet.flags.contains(&"FIN".to_string()) {
            anomalies.push("Invalid TCP flags: SYN+FIN".to_string());
        }

        // NULL scan (no flags)
        if packet.flags.is_empty() {
            anomalies.push("NULL TCP scan detected".to_string());
        }

        // XMAS scan (FIN+PSH+URG)
        if packet.flags.contains(&"FIN".to_string()) 
            && packet.flags.contains(&"PSH".to_string()) 
            && packet.flags.contains(&"URG".to_string()) {
            anomalies.push("XMAS TCP scan detected".to_string());
        }
    }

    // Check for unusually small or large packets
    if packet.payload_size == 0 && packet.protocol == "TCP" {
        if !packet.flags.contains(&"SYN".to_string()) 
            && !packet.flags.contains(&"FIN".to_string()) 
            && !packet.flags.contains(&"RST".to_string()) {
            anomalies.push("Empty TCP payload (possible scan)".to_string());
        }
    }

    anomalies
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packet_anomaly_detection() {
        let mut packet = PacketAnalysis {
            packet_type: "ethernet".to_string(),
            source_ip: Some("192.168.1.100".to_string()),
            dest_ip: Some("192.168.1.1".to_string()),
            source_port: Some(4444),
            dest_port: Some(80),
            protocol: "TCP".to_string(),
            payload_size: 0,
            flags: vec!["SYN".to_string(), "FIN".to_string()],
            timestamp: Some(1234567890),
        };

        let anomalies = check_packet_anomalies(&packet);
        assert!(anomalies.contains(&"Suspicious port detected".to_string()));
        assert!(anomalies.contains(&"Invalid TCP flags: SYN+FIN".to_string()));
    }
}